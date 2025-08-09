import { getCurrentPalette, markNeedsRerender, setPalette } from "@/camera/palette";
import type { Palette } from "@/color";
import { addTraceEvent } from "@/event-viewer/event";
import {
  getIterationCache,
  scaleIterationCacheAroundPoint,
  setIterationCache,
  translateRectInIterationCache,
} from "@/iteration-buffer/iteration-buffer";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import type { Rect } from "@/math/rect";
import { getStore } from "@/store/store";
import type { IterationBuffer } from "@/types";
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
});

const PaletteSchema = d.arrayOf(d.vec4f, 8192); // FIXME: paletteの最大サイズ分固定で確保している（手抜き）

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
  }),
  1024,
);

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

export const renderToCanvas: Renderer["renderToCanvas"] = (x, y, width, height) => {
  if (!gpuInitialized) {
    console.warn("WebGPU not yet initialized, skipping render");
    return;
  }

  const params = getCurrentParams();
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
  const palette = getCurrentPalette();

  // queueに積まれたiteration bufferをGPUBufferに書き込む
  let bufferByteOffset = 0;
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
  });

  if (0 < processableCount) {
    const remaining = iterationBufferQueue.length - processableCount;

    const resolution =
      iterationBufferQueue[0].rect.width / iterationBufferQueue[0].resolution.width;
    const rects: Rect[] = [];

    // 処理可能な数だけ処理
    for (let idx = 0; idx < processableCount; idx++) {
      const iteration = iterationBufferQueue.shift()!;
      const { rect, buffer, resolution, isSuperSampled } = iteration;
      rects.push(rect);

      iterationInputMetadataBuffer.writePartial([
        {
          idx,
          value: {
            rectX: rect.x,
            rectY: rect.y,
            rectWidth: rect.width,
            rectHeight: rect.height,
            resolutionWidth: resolution.width,
            resolutionHeight: resolution.height,
            bufferLength: buffer.length,
            isSuperSampled: isSuperSampled ? 1 : 0,
          },
        },
      ]);

      device.queue.writeBuffer(
        root.unwrap(iterationInputBuffer),
        bufferByteOffset,
        buffer,
        0,
        buffer.length,
      );

      bufferByteOffset += buffer.byteLength;
    }

    addTraceEvent("renderer", {
      type: "iterationBufferProcessing",
      resolution,
      count: processableCount,
      remaining,
      rects,
    });
  }

  // 毎フレームのunifiedIterationBufferの転送は不要
  // GPUのcompute shaderによってiterationInputBufferからiterationBufferに直接書き込まれる

  const encoder = device.createCommandEncoder();

  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, root.unwrap(bindGroup));
  computePass.dispatchWorkgroups(64);
  computePass.end();

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

  const maxSize = getStore("maxCanvasSize");

  const w = maxSize === -1 ? requestWidth : Math.min(requestWidth, maxSize);
  const h = maxSize === -1 ? requestHeight : Math.min(requestHeight, maxSize);

  console.debug(`Resize to: w=${w}, h=${h} (maxCanvasSize=${maxSize})`);

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

  const scaleFactor = Math.min(width, height) / Math.min(from.width, from.height);

  console.debug("Resize scale factor", scaleFactor);

  // サイズ差の分trasnlateしてからscale
  const offsetX = Math.round((width - from.width) / 2);
  const offsetY = Math.round((height - from.height) / 2);
  translateRectInIterationCache(-offsetX, -offsetY);

  const translated = scaleIterationCacheAroundPoint(
    width / 2,
    height / 2,
    scaleFactor,
    width,
    height,
  );
  setIterationCache(translated);
  addIterationBuffer();

  markNeedsRerender();
};

export const updatePaletteData: Renderer["updatePaletteData"] = (palette: Palette) => {
  if (!gpuInitialized) return;

  // FIXME: Palette側に定義しとくといいよ
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette.rgb(i);
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
