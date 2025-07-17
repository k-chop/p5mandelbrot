import {
  getCurrentPalette,
  markNeedsRerender,
  setPalette,
} from "@/camera/palette";
import type { Palette } from "@/color";
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
  type TgpuBuffer,
  type TgpuRoot,
} from "typegpu";
import * as d from "typegpu/data";
import computeShaderCode from "./shader/compute.wgsl?raw";
import renderShaderCode from "./shader/shader.wgsl?raw";

let width: number;
let height: number;

let bufferRect: Rect;

let root: TgpuRoot;
let device: GPUDevice;
let context: GPUCanvasContext;
let bindGroupLayout: GPUBindGroupLayout;
let bindGroup: GPUBindGroup;
let renderPipeline: GPURenderPipeline;
let computePipeline: GPUComputePipeline;

let vertexTypedBuffer: TgpuBuffer<d.WgslArray<d.Vec2f>>;
let uniformTypedBuffer: TgpuBuffer<d.WgslArray<d.F32>>;
let paletteTypedBuffer: TgpuBuffer<d.WgslArray<d.F32>> & StorageFlag;
let iterationInputTypedBuffer: TgpuBuffer<d.WgslArray<d.U32>> & StorageFlag;
let iterationInputMetadataTypedBuffer: TgpuBuffer<d.WgslArray<d.F32>> &
  StorageFlag;
let iterationTypedBuffer: TgpuBuffer<d.WgslArray<d.U32>> & StorageFlag;

const iterationBufferQueue: IterationBuffer[] = [];

let gpuInitialized = false;

export const getCanvasSize = () => ({ width, height });
export const getWholeCanvasRect = () => ({ x: 0, y: 0, width, height });

/**
 * WebGPUレンダラーを初期化する
 * @param w 幅
 * @param h 高さ
 * @returns 初期化が成功したかどうか
 */
export const initRenderer = async (w: number, h: number): Promise<boolean> => {
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

export const renderToCanvas = (
  x: number,
  y: number,
  width?: number,
  height?: number,
) => {
  if (!gpuInitialized) {
    console.warn("WebGPU not yet initialized, skipping render");
    return;
  }

  const params = getCurrentParams();
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
  const palette = getCurrentPalette();

  // queueに積まれたiteration bufferをGPUBufferに書き込む
  let bufferByteOffset = 0;
  const maxBufferSize = iterationInputTypedBuffer.buffer.size;

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

    // バッファサイズオーバーチェック
    if (tempBufferByteOffset + nextSize > maxBufferSize) {
      console.log(
        `Buffer size exceeded: ${tempBufferByteOffset} + ${nextSize} > ${maxBufferSize}, remaining: ${
          iterationBufferQueue.length - processableCount
        }`,
      );
      break;
    }

    const resolution = iterBuffer.rect.width / iterBuffer.resolution.width;

    // 初回または同じ解像度のみ処理
    if (currentResolution === -1) {
      currentResolution = resolution;
    } else if (Math.abs(resolution - currentResolution) > 0.001) {
      // 解像度が変わったら処理を中断
      console.log(
        `Resolution changed: ${currentResolution} -> ${resolution}, remaining: ${iterationBufferQueue.length - processableCount}`,
      );
      break;
    }

    tempBufferByteOffset += nextSize;
    processableCount++;
  }

  // write uniform buffer
  uniformTypedBuffer.write([
    params.N, // maxIteration
    canvasWidth, // canvasWidth
    canvasHeight, // canvasHeight
    palette.offset, // paletteOffset
    palette.length, // paletteSize
    x, // offsetX
    y, // offsetY
    width ?? canvasWidth, // renderWidth
    height ?? canvasHeight, // renderHeight
    processableCount, // iterationBufferCount：実際に処理する数
  ]);

  if (0 < processableCount) {
    console.log(
      `Processing ${processableCount} iteration buffers (total: ${iterationBufferQueue.length}, remaining: ${iterationBufferQueue.length - processableCount})`,
    );
    // 処理可能な数だけ処理
    for (let idx = 0; idx < processableCount; idx++) {
      const iteration = iterationBufferQueue.shift()!;
      const { rect, buffer, resolution, isSuperSampled } = iteration;

      // metadata
      const metadata = new Float32Array([
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        resolution.width,
        resolution.height,
        buffer.length,
        isSuperSampled ? 1 : 0,
      ]);
      // FIXME: ここはもうちょい良い感じに書き込めるので直す
      device.queue.writeBuffer(
        root.unwrap(iterationInputMetadataTypedBuffer),
        idx * 8 * 4, // 8要素 × 4バイト (Float32Array)
        metadata,
      );

      device.queue.writeBuffer(
        root.unwrap(iterationInputTypedBuffer),
        bufferByteOffset,
        buffer,
        0,
        buffer.length,
      );

      bufferByteOffset += buffer.byteLength;
    }
  }

  // 毎フレームのunifiedIterationBufferの転送は不要
  // GPUのcompute shaderによってiterationInputBufferからiterationBufferに直接書き込まれる

  const encoder = device.createCommandEncoder();

  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, bindGroup);
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
  renderPass.setBindGroup(0, bindGroup);
  renderPass.setVertexBuffer(0, root.unwrap(vertexTypedBuffer));
  renderPass.draw(6); // fixed 2 triangle
  renderPass.end();

  device.queue.submit([encoder.finish()]);
};

export const addIterationBuffer = (
  _rect: Rect = bufferRect,
  iterBuffer?: IterationBuffer[],
) => {
  if (!gpuInitialized) return;

  iterationBufferQueue.push(...(iterBuffer ?? getIterationCache()));
};

export const resizeCanvas = (requestWidth: number, requestHeight: number) => {
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

  iterationTypedBuffer.destroy();
  iterationTypedBuffer = root
    .createBuffer(d.arrayOf(d.u32, width * height))
    .$usage("storage");

  createBindGroup();

  const scaleFactor =
    Math.min(width, height) / Math.min(from.width, from.height);

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

export const updatePaletteDataForGPU = (palette: Palette) => {
  if (!gpuInitialized) return;

  const paletteData = [];
  // FIXME: Palette側に定義しとくといいよ
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette.rgb(i);
    paletteData.push(...[r / 255, g / 255, b / 255, 1.0]);
  }

  paletteTypedBuffer.write(paletteData);
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

    const gpuCanvas = document.getElementById(
      "gpu-canvas",
    ) as HTMLCanvasElement;
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
    vertexTypedBuffer = root
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
    const geometryLayout = tgpu.vertexLayout((n) =>
      d.arrayOf(PlaneGeometry, n),
    );

    const renderShaderModule = device.createShaderModule({
      label: "Mandelbrot set shader",
      code: renderShaderCode,
    });

    const computeShaderModule = device.createShaderModule({
      label: "Mandelbrot set compute shader",
      code: computeShaderCode,
    });

    uniformTypedBuffer = root
      .createBuffer(d.arrayOf(d.f32, 10))
      .$usage("uniform");

    iterationTypedBuffer = root
      .createBuffer(d.arrayOf(d.u32, width * height))
      .$usage("storage");

    // TODO: d.vec4f, 8192でも良い気がするがbufferに書き込むところでなんかエラー出る
    paletteTypedBuffer = root
      .createBuffer(d.arrayOf(d.f32, 8192 * 4)) // FIXME: paletteの最大サイズ分で確保している（手抜き）
      .$usage("storage");

    iterationInputTypedBuffer = root
      .createBuffer(d.arrayOf(d.u32, width * height))
      .$usage("storage");

    iterationInputMetadataTypedBuffer = root
      .createBuffer(
        // FIXME: f32で渡してshader側でi32に変換してて謎。あとstruct使え
        d.arrayOf(d.f32, 4 * 8 * 1024),
      )
      .$usage("storage");

    bindGroupLayout = device.createBindGroupLayout({
      label: "Mandelbrot BindGroupLayout",
      entries: [
        {
          // uniform
          binding: 0,
          visibility:
            GPUShaderStage.FRAGMENT |
            GPUShaderStage.VERTEX |
            GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          // iterations
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          // palette
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          // iteration buffer input
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          // iteration buffer metadata
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    createBindGroup();

    const pipelineLayout = device.createPipelineLayout({
      label: "Mandelbrot Pipeline Layout",
      bindGroupLayouts: [bindGroupLayout],
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

const createBindGroup = () => {
  bindGroup = device.createBindGroup({
    label: "Mandelbrot BindGroup",
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: root.unwrap(uniformTypedBuffer) },
      },
      {
        binding: 1,
        resource: { buffer: root.unwrap(iterationTypedBuffer) },
      },
      {
        binding: 2,
        resource: { buffer: root.unwrap(paletteTypedBuffer) },
      },
      {
        binding: 3,
        resource: { buffer: root.unwrap(iterationInputTypedBuffer) },
      },
      {
        binding: 4,
        resource: { buffer: root.unwrap(iterationInputMetadataTypedBuffer) },
      },
    ],
  });
};
