import { getCurrentPalette, setPalette } from "@/camera/palette";
import type { Palette } from "@/color";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import type { Rect } from "@/math/rect";
import { getStore } from "@/store/store";
import type { IterationBuffer } from "@/types";
import computeShaderCode from "./shader/compute.wgsl?raw";
import renderShaderCode from "./shader/shader.wgsl?raw";

let width: number;
let height: number;

let bufferRect: Rect;

let device: GPUDevice;
let context: GPUCanvasContext;
let bindGroupLayout: GPUBindGroupLayout;
let bindGroup: GPUBindGroup;
let renderPipeline: GPURenderPipeline;
let computePipeline: GPUComputePipeline;
let vertexBuffer: GPUBuffer;
let vertices: Float32Array;

let uniformBuffer: GPUBuffer;
let uniformData: Float32Array;
let iterationBuffer: GPUBuffer;
let paletteBuffer: GPUBuffer;
let paletteData: Float32Array;
let iterationInputBuffer: GPUBuffer;
let iterationInputData: Uint32Array;
let iterationInputMetadataBuffer: GPUBuffer;

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
  paletteData = new Float32Array(8192 * 4); // FIXME: paletteの最大サイズ分で確保している（手抜き）
  iterationInputData = new Uint32Array(w * h); // FIXME: 分割数に関わらず最大サイズで確保している

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
  if (!gpuInitialized) return;

  const params = getCurrentParams();
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
  const palette = getCurrentPalette();

  const uniformData = new Float32Array([
    params.N, // maxIteration
    canvasWidth, // canvasWidth
    canvasHeight, // canvasHeight
    palette.offset, // paletteOffset
    palette.length, // paletteSize
    x, // offsetX
    y, // offsetY
    width ?? canvasWidth, // renderWidth
    height ?? canvasHeight, // renderHeight
    iterationBufferQueue.length, // iterationBufferCount
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  // queueに積まれたiteration bufferをGPUBufferに書き込む
  let bufferByteOffset = 0;
  if (0 < iterationBufferQueue.length) {
    const length = iterationBufferQueue.length;
    // TODO: たぶんiterationInputBufferの長さに足りない場合は次回に回すとか必要そう

    for (let idx = 0; idx < length; idx++) {
      const iteration = iterationBufferQueue.shift()!;
      const { rect, buffer, resolution, isSuperSampled } = iteration;
      // TODO: resolutionも渡す必要がある気がしてきた

      // metadata
      const metadata = new Uint32Array([
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        resolution.width,
        resolution.height,
        buffer.length,
        isSuperSampled ? 1 : 0, // isSuperSampled情報も追加
      ]);
      device.queue.writeBuffer(
        iterationInputMetadataBuffer,
        idx * 8 * 4, // 8要素 × 4バイト (Uint32Array)
        metadata,
      );

      device.queue.writeBuffer(
        iterationInputBuffer,
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
  renderPass.setVertexBuffer(0, vertexBuffer);
  renderPass.draw(vertices.length / 2);
  renderPass.end();

  device.queue.submit([encoder.finish()]);
};

export const addIterationBuffer = (
  _rect: Rect = bufferRect,
  iterBuffer: IterationBuffer[] = [],
) => {
  if (!gpuInitialized) return;

  iterationBufferQueue.push(...iterBuffer);
};

export const resizeCanvas = (requestWidth: number, requestHeight: number) => {
  if (!gpuInitialized) return;

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
  iterationBuffer = device.createBuffer({
    label: "iteration buffer",
    size: width * height * 4, // Uint32Array
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  createBindGroup();
};

export const updatePaletteDataForGPU = (palette: Palette) => {
  if (!gpuInitialized) return;

  // FIXME: Palette側に定義しとくといいよ
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette.rgb(i);
    paletteData[i * 4] = r / 255;
    paletteData[i * 4 + 1] = g / 255;
    paletteData[i * 4 + 2] = b / 255;
    paletteData[i * 4 + 3] = 1.0;
  }

  device.queue.writeBuffer(paletteBuffer, 0, paletteData);
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
    vertices = new Float32Array([
      -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ]);
    vertexBuffer = device.createBuffer({
      label: "vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
      arrayStride: 8,
      attributes: [
        {
          format: "float32x2" as GPUVertexFormat,
          offset: 0,
          shaderLocation: 0,
        },
      ],
    };

    const renderShaderModule = device.createShaderModule({
      label: "Mandelbrot set shader",
      code: renderShaderCode,
    });

    const computeShaderModule = device.createShaderModule({
      label: "Mandelbrot set compute shader",
      code: computeShaderCode,
    });

    uniformBuffer = device.createBuffer({
      label: "uniform buffer",
      size: 48, // uint32 * 9 = 36 だけど16の倍数にしとく
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    iterationBuffer = device.createBuffer({
      label: "iteration buffer",
      size: width * height * 4, // Uint32Array,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    paletteBuffer = device.createBuffer({
      label: "palette buffer",
      size: paletteData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    iterationInputBuffer = device.createBuffer({
      label: "iteration input buffer",
      size: iterationInputData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    iterationInputMetadataBuffer = device.createBuffer({
      label: "iteration input metadata buffer",
      size: 4 * 8 * 1024, // uint32(4バイト) * 8要素 * 1024分割までサポート
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

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
        buffers: [vertexBufferLayout],
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
        resource: { buffer: uniformBuffer },
      },
      {
        binding: 1,
        resource: { buffer: iterationBuffer },
      },
      {
        binding: 2,
        resource: { buffer: paletteBuffer },
      },
      {
        binding: 3,
        resource: { buffer: iterationInputBuffer },
      },
      {
        binding: 4,
        resource: { buffer: iterationInputMetadataBuffer },
      },
    ],
  });
};
