import { getCurrentPalette, setPalette } from "../camera/palette";
import type { Palette } from "../color";
import { addTraceEvent } from "../event-viewer/event";
import { getIterationCache } from "../iteration-buffer/iteration-buffer";
import { applyMaxCanvasSize, rescaleIterationCacheForResize } from "./common";
import { getCurrentParams } from "../mandelbrot-state/mandelbrot-state";
import type { Rect } from "../math/rect";
import type { IterationBuffer } from "../types";
import tgpu, {
  type StorageFlag,
  type TgpuBindGroup,
  type TgpuBindGroupLayout,
  type TgpuBuffer,
  type TgpuRoot,
  type UniformFlag,
  type VertexFlag,
} from "typegpu";
import * as d from "typegpu/data";
import type { Renderer } from "./renderer";
import computeShaderCode from "./shader/compute.wgsl?raw";
import renderShaderCode from "./shader/shader.wgsl?raw";

let width: number;
let height: number;

let bufferRect: Rect;

let root: TgpuRoot;
let device: GPUDevice;
let context: GPUCanvasContext;

let renderPipeline: GPURenderPipeline;
let computePipeline: GPUComputePipeline;

let bindGroup: TgpuBindGroup;
let bindGroupLayout: TgpuBindGroupLayout;

let vertexBuffer: TgpuBuffer<d.WgslArray<d.Vec2f>> & VertexFlag;
let uniformBuffer: TgpuBuffer<typeof UniformSchema> & UniformFlag;
let paletteBuffer: TgpuBuffer<d.WgslArray<d.Vec4f>> & StorageFlag;
let iterationInputBuffer: TgpuBuffer<d.WgslArray<d.U32>> & StorageFlag;
let iterationInputMetadataBuffer: TgpuBuffer<typeof IterationInputMetadataSchema> & StorageFlag;
let iterationBuffer: TgpuBuffer<d.WgslArray<d.U32>> & StorageFlag;

const iterationBufferQueue: IterationBuffer[] = [];

let gpuInitialized = false;
let isFlushing = false;

const UniformSchema = d.struct({
  maxIterations: d.f32,
  canvasWidth: d.f32,
  canvasHeight: d.f32,
  paletteOffset: d.f32,
  paletteSize: d.f32,
  offsetX: d.f32,
  offsetY: d.f32,
  width: d.f32,
  height: d.f32,
  iterationBufferCount: d.f32,
  totalPixelCount: d.f32,
});

const PaletteSchema = d.arrayOf(d.vec4f, 8192); // FIXME: paletteの最大サイズ分固定で確保している（手抜き）

/** metadataに格納できるiteration bufferの最大数 */
const META_ENTRY_MAX = 1024;

/**
 * metadata 1エントリあたりのf32数
 *
 * compute.wgsl の META_STRIDE およびFIELD_*の並びと一致させること。
 * shader側はこのbufferを array<f32> として読むため、structはtightly packedである必要がある。
 */
const META_STRIDE = 14;

/** compute shaderのworkgroupサイズ。compute.wgsl の @workgroup_size と一致させること */
const COMPUTE_WORKGROUP_SIZE = 64;

/** dispatchWorkgroupsの1次元あたりの上限。超える分はshader側のgrid-strideループで処理する */
const MAX_COMPUTE_WORKGROUPS = 65535;

const IterationInputMetadataSchema = d.arrayOf(
  d.struct({
    rectX: d.f32,
    rectY: d.f32,
    rectWidth: d.f32,
    rectHeight: d.f32,
    resolutionWidth: d.f32,
    resolutionHeight: d.f32,
    bufferLength: d.f32,
    isSuperSampled: d.f32,
    dataStart: d.f32,
    pixelStart: d.f32,
    clipX: d.f32,
    clipY: d.f32,
    clipWidth: d.f32,
    clipHeight: d.f32,
  }),
  META_ENTRY_MAX,
);

/** metadata書き込み用の使い回しバッファ。毎フレームのallocを避けるために持つ */
const metadataScratch = new Float32Array(META_ENTRY_MAX * META_STRIDE);

export const getCanvasSize: Renderer["getCanvasSize"] = () => ({
  width,
  height,
});
export const getWholeCanvasRect: Renderer["getWholeCanvasRect"] = () => ({
  x: 0,
  y: 0,
  width,
  height,
});

/**
 * WebGPUレンダラーを初期化する
 * @param w 幅
 * @param h 高さ
 * @returns 初期化が成功したかどうか
 */
export const initRenderer: Renderer["initRenderer"] = async (w, h) => {
  // TODO: あとでmaxSizeを変えられるようにする
  const resolutionLimit = 134217728 / 32; // default storage buffer maximum size = 128MiB, iteration = Uint32
  if (w * h > resolutionLimit) {
    const msg = `Resolution is too high: ${w}x${h}`;
    console.error(msg);
    return false;
  }

  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };

  try {
    await initializeGPU();
    return gpuInitialized;
  } catch (e) {
    console.error("Failed to initialize WebGPU:", e);
    gpuInitialized = false;
    return false;
  }
};

const clampInt = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * iteration bufferの内容をGPUのinput bufferとmetadata bufferに書き込む
 *
 * 各itemについてcanvasでクリップした宛先ピクセル数を求め、その前置和(pixelStart)をmetadataに載せる。
 * compute shaderはこの前置和を二分探索することで、1スレッド1宛先ピクセルで処理できる。
 *
 * 戻り値は全itemの宛先ピクセル数の合計 (= compute shaderに必要なthread数)
 */
const writeIterationInputs = (
  items: IterationBuffer[],
  canvasWidth: number,
  canvasHeight: number,
): number => {
  let bufferByteOffset = 0;
  let dataStart = 0;
  let pixelStart = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const { rect, buffer, resolution, isSuperSampled } = items[idx];

    // scaleRectAroundPointがwidth/heightを丸めずに返すためrectは小数になりうる。
    // 従来shader側の i32() で切り捨てていたので、同じ値をCPU側で作る
    const rectX = Math.trunc(rect.x);
    const rectY = Math.trunc(rect.y);
    const rectWidth = Math.trunc(rect.width);
    const rectHeight = Math.trunc(rect.height);

    const clipX = clampInt(rectX, 0, canvasWidth);
    const clipY = clampInt(rectY, 0, canvasHeight);
    const clipWidth = clampInt(rectX + rectWidth, 0, canvasWidth) - clipX;
    const clipHeight = clampInt(rectY + rectHeight, 0, canvasHeight) - clipY;

    const offset = idx * META_STRIDE;
    metadataScratch[offset] = rectX;
    metadataScratch[offset + 1] = rectY;
    metadataScratch[offset + 2] = rectWidth;
    metadataScratch[offset + 3] = rectHeight;
    metadataScratch[offset + 4] = resolution.width;
    metadataScratch[offset + 5] = resolution.height;
    metadataScratch[offset + 6] = buffer.length;
    metadataScratch[offset + 7] = isSuperSampled ? 1 : 0;
    metadataScratch[offset + 8] = dataStart;
    metadataScratch[offset + 9] = pixelStart;
    metadataScratch[offset + 10] = clipX;
    metadataScratch[offset + 11] = clipY;
    metadataScratch[offset + 12] = clipWidth;
    metadataScratch[offset + 13] = clipHeight;

    device.queue.writeBuffer(
      root.unwrap(iterationInputBuffer),
      bufferByteOffset,
      buffer,
      0,
      buffer.length,
    );

    bufferByteOffset += buffer.byteLength;
    dataStart += buffer.length;
    pixelStart += clipWidth * clipHeight;
  }

  device.queue.writeBuffer(
    root.unwrap(iterationInputMetadataBuffer),
    0,
    metadataScratch,
    0,
    items.length * META_STRIDE,
  );

  return pixelStart;
};

/**
 * iterationInputBufferからiterations[]へコピーするcompute passを積む
 *
 * 1スレッドが1宛先ピクセルを担当するので、dispatch数は宛先ピクセル数から決まる
 */
const encodeCopyComputePass = (encoder: GPUCommandEncoder, totalPixelCount: number) => {
  if (totalPixelCount === 0) return;

  const workgroupCount = Math.min(
    Math.ceil(totalPixelCount / COMPUTE_WORKGROUP_SIZE),
    MAX_COMPUTE_WORKGROUPS,
  );

  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, root.unwrap(bindGroup));
  computePass.dispatchWorkgroups(workgroupCount);
  computePass.end();
};

export const renderToCanvas: Renderer["renderToCanvas"] = (x, y, width, height) => {
  if (isFlushing) return;
  if (!gpuInitialized) {
    console.warn("WebGPU not yet initialized, skipping render");
    return;
  }

  const params = getCurrentParams();
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
  const palette = getCurrentPalette();

  // queueに積まれたiteration bufferをGPUBufferに書き込む
  const maxBufferSize = iterationInputBuffer.buffer.size;

  // 解像度（rect.width/resolution.width）が荒い順にソートする
  // 値が大きいほど1ピクセルあたりの解像度が荒い
  if (iterationBufferQueue.length > 1) {
    iterationBufferQueue.sort((a, b) => {
      const resolutionA = a.rect.width / a.resolution.width;
      const resolutionB = b.rect.width / b.resolution.width;
      return resolutionB - resolutionA; // 降順（荒い順）
    });
  }

  // 一度に処理できる最大数を計算
  let processableCount = 0;
  let tempBufferByteOffset = 0;
  let currentResolution = -1; // 現在処理中の解像度

  // ソートされたキューから同じ解像度のバッファのみを処理
  for (let i = 0; i < iterationBufferQueue.length; i++) {
    const iterBuffer = iterationBufferQueue[i];
    const nextSize = iterBuffer.buffer.byteLength;
    const resolution = iterBuffer.rect.width / iterBuffer.resolution.width;

    // metadataに載る数を超えないようにする
    if (processableCount >= META_ENTRY_MAX) break;

    // バッファサイズオーバーチェック
    if (tempBufferByteOffset + nextSize > maxBufferSize) {
      const remaining = iterationBufferQueue.length - processableCount;
      addTraceEvent("renderer", { type: "bufferSizeExceeded", remaining });
      break;
    }

    // 初回または同じ解像度のみ処理
    if (currentResolution === -1) {
      currentResolution = resolution;
    } else if (Math.abs(resolution - currentResolution) > 0.001) {
      // 解像度が変わったら処理を中断
      break;
    }

    tempBufferByteOffset += nextSize;
    processableCount++;
  }

  let totalPixelCount = 0;

  if (0 < processableCount) {
    const remaining = iterationBufferQueue.length - processableCount;
    const resolution =
      iterationBufferQueue[0].rect.width / iterationBufferQueue[0].resolution.width;

    const items = iterationBufferQueue.splice(0, processableCount);
    totalPixelCount = writeIterationInputs(items, canvasWidth, canvasHeight);

    addTraceEvent("renderer", {
      type: "iterationBufferProcessing",
      resolution,
      count: processableCount,
      remaining,
      rects: items.map((item) => item.rect),
    });
  }

  // write uniform buffer
  uniformBuffer.write({
    maxIterations: params.N,
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    paletteOffset: palette.offset,
    paletteSize: palette.length,
    offsetX: x,
    offsetY: y,
    width: width ?? canvasWidth,
    height: height ?? canvasHeight,
    iterationBufferCount: processableCount,
    totalPixelCount,
  });

  // 毎フレームのunifiedIterationBufferの転送は不要
  // GPUのcompute shaderによってiterationInputBufferからiterationBufferに直接書き込まれる

  const encoder = device.createCommandEncoder();

  encodeCopyComputePass(encoder, totalPixelCount);

  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue: { r: 0, g: 0, b: 0.4, a: 1 },
        storeOp: "store",
      },
    ],
  });

  renderPass.setPipeline(renderPipeline);
  renderPass.setBindGroup(0, root.unwrap(bindGroup));
  renderPass.setVertexBuffer(0, root.unwrap(vertexBuffer));
  renderPass.draw(6); // fixed 2 triangle
  renderPass.end();

  device.queue.submit([encoder.finish()]);
};

/**
 * iterationBufferQueueを全て処理してGPU iterations[]を更新し、完了を待つ
 *
 * translate後にGPUバッファを即座に最新化し、次フレームで古いデータが描画されるのを防ぐ
 */
export const flushIterationBufferQueue = async (): Promise<void> => {
  if (!gpuInitialized || iterationBufferQueue.length === 0) return;

  isFlushing = true;

  try {
    // iterationBufferを0クリアして古い位置のデータを除去
    {
      const encoder = device.createCommandEncoder();
      encoder.clearBuffer(root.unwrap(iterationBuffer));
      device.queue.submit([encoder.finish()]);
    }

    const params = getCurrentParams();
    const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
    const palette = getCurrentPalette();

    while (iterationBufferQueue.length > 0) {
      const maxBufferSize = iterationInputBuffer.buffer.size;
      let tempByteOffset = 0;
      let processableCount = 0;

      for (let i = 0; i < iterationBufferQueue.length; i++) {
        if (processableCount >= META_ENTRY_MAX) break;

        const nextSize = iterationBufferQueue[i].buffer.byteLength;
        if (tempByteOffset + nextSize > maxBufferSize) break;
        tempByteOffset += nextSize;
        processableCount++;
      }

      if (processableCount === 0) break;

      const items = iterationBufferQueue.splice(0, processableCount);
      const totalPixelCount = writeIterationInputs(items, canvasWidth, canvasHeight);

      uniformBuffer.write({
        maxIterations: params.N,
        canvasWidth,
        canvasHeight,
        paletteOffset: palette.offset,
        paletteSize: palette.length,
        offsetX: 0,
        offsetY: 0,
        width: canvasWidth,
        height: canvasHeight,
        iterationBufferCount: processableCount,
        totalPixelCount,
      });

      const encoder = device.createCommandEncoder();
      encodeCopyComputePass(encoder, totalPixelCount);
      device.queue.submit([encoder.finish()]);

      await device.queue.onSubmittedWorkDone();
    }
  } finally {
    isFlushing = false;
  }
};

export const addIterationBuffer: Renderer["addIterationBuffer"] = (
  _rect = bufferRect,
  iterBuffer,
) => {
  if (!gpuInitialized) return;

  iterationBufferQueue.push(...(iterBuffer ?? getIterationCache()));
};

export const resizeCanvas: Renderer["resizeCanvas"] = (requestWidth, requestHeight) => {
  if (!gpuInitialized) return;

  const from = getCanvasSize();

  const gpuCanvas = document.getElementById("gpu-canvas")! as HTMLCanvasElement;

  const { width: w, height: h } = applyMaxCanvasSize(requestWidth, requestHeight);

  console.debug(`Resize to: w=${w}, h=${h}`);

  gpuCanvas.width = w;
  gpuCanvas.height = h;

  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };

  context = gpuCanvas.getContext("webgpu")!;
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
  });

  iterationBuffer.destroy();
  iterationBuffer = root.createBuffer(d.arrayOf(d.u32, width * height)).$usage("storage");

  bindGroup = createBindGroup(bindGroupLayout);

  rescaleIterationCacheForResize(from, { width, height });
};

export const updatePaletteData: Renderer["updatePaletteData"] = (palette: Palette) => {
  if (!gpuInitialized) return;

  // FIXME: Palette側に定義しとくといいよ
  for (let i = 0; i < palette.length; i++) {
    // offsetに影響しないpalette dataを取得したいのでignoreOffset: true
    const [r, g, b] = palette.rgb(i, true);
    paletteBuffer.writePartial([{ idx: i, value: d.vec4f(r / 255, g / 255, b / 255, 1.0) }]);
  }
};

const initializeGPU = async (): Promise<boolean> => {
  if (!navigator.gpu) {
    console.log("WebGPU not supported on this browser.");
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.log("No appropriate GPUAdapter found.");
    return false;
  }

  try {
    device = await adapter.requestDevice();
    root = tgpu.initFromDevice({ device });

    const gpuCanvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
    if (!gpuCanvas) {
      console.error("WebGPU canvas element not found");
      return false;
    }

    const ctx = gpuCanvas.getContext("webgpu");
    if (!ctx) {
      console.error("Could not get WebGPU context from canvas");
      return false;
    }
    context = ctx;

    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: device,
      format: canvasFormat,
    });

    // 頂点バッファ（特に変化しない）
    vertexBuffer = root
      .createBuffer(d.arrayOf(d.vec2f, 6), [
        d.vec2f(-1.0, -1.0),
        d.vec2f(1.0, -1.0),
        d.vec2f(1.0, 1.0),
        d.vec2f(-1.0, -1.0),
        d.vec2f(1.0, 1.0),
        d.vec2f(-1.0, 1.0),
      ])
      .$usage("vertex");

    const PlaneGeometry = d.struct({
      xy: d.location(0, d.vec2f),
    });
    const geometryLayout = tgpu.vertexLayout((n) => d.arrayOf(PlaneGeometry, n));

    uniformBuffer = root.createBuffer(UniformSchema).$usage("uniform");

    iterationBuffer = root.createBuffer(d.arrayOf(d.u32, width * height)).$usage("storage");

    paletteBuffer = root.createBuffer(PaletteSchema).$usage("storage");

    iterationInputBuffer = root.createBuffer(d.arrayOf(d.u32, width * height)).$usage("storage");

    iterationInputMetadataBuffer = root
      .createBuffer(IterationInputMetadataSchema)
      .$usage("storage");

    bindGroupLayout = tgpu.bindGroupLayout({
      uniforms: { uniform: UniformSchema },
      iterations: {
        storage: d.arrayOf(d.u32, width * height),
        visibility: ["fragment", "compute"],
        access: "mutable",
      },
      palette: {
        storage: PaletteSchema,
        visibility: ["fragment"],
      },
      iterationInput: {
        storage: d.arrayOf(d.u32, width * height),
        visibility: ["compute"],
      },
      iterationMetadata: {
        storage: IterationInputMetadataSchema,
        visibility: ["compute"],
      },
    });

    bindGroup = createBindGroup(bindGroupLayout);

    const pipelineLayout = device.createPipelineLayout({
      label: "Mandelbrot Pipeline Layout",
      bindGroupLayouts: [root.unwrap(bindGroupLayout)],
    });

    const renderShaderModule = device.createShaderModule({
      label: "Mandelbrot set shader",
      code: renderShaderCode,
    });
    const computeShaderModule = device.createShaderModule({
      label: "Mandelbrot set compute shader",
      code: computeShaderCode,
    });

    renderPipeline = device.createRenderPipeline({
      label: "Mandelbrot set pipeline",
      layout: pipelineLayout,
      vertex: {
        module: renderShaderModule,
        entryPoint: "vertexMain",
        buffers: [root.unwrap(geometryLayout)],
      },
      fragment: {
        module: renderShaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: canvasFormat }],
      },
    });

    computePipeline = device.createComputePipeline({
      label: "Mandelbrot set compute pipeline",
      layout: pipelineLayout,
      compute: {
        module: computeShaderModule,
        entryPoint: "computeMain",
      },
    });

    gpuInitialized = true;
    console.log("WebGPU initialized successfully!");

    setPalette();
    return true;
  } catch (e) {
    console.error("WebGPU initialization error:", e);
    return false;
  }
};

const createBindGroup = (bindGroupLayout: TgpuBindGroupLayout) => {
  return root.createBindGroup(bindGroupLayout, {
    uniforms: uniformBuffer,
    iterations: iterationBuffer,
    palette: paletteBuffer,
    iterationInput: iterationInputBuffer,
    iterationMetadata: iterationInputMetadataBuffer,
  });
};
