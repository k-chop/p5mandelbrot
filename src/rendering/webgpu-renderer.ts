import { getCurrentPalette, setPalette } from "@/camera/palette";
import type { Palette } from "@/color";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import type { Rect } from "@/math/rect";
import type { IterationBuffer } from "@/types";
import shaderCode from "./shader/shader.wgsl?raw";

let width: number;
let height: number;

let bufferRect: Rect;

let unifiedIterationBuffer: Uint32Array;

let device: GPUDevice;
let context: GPUCanvasContext;
let pipeline: GPURenderPipeline;
let vertexBuffer: GPUBuffer;
let vertices: Float32Array;

let uniformBuffer: GPUBuffer;
let uniformData: Uint32Array;
let iterationBuffer: GPUBuffer;
let paletteBuffer: GPUBuffer;
let paletteData: Float32Array;

let bindGroup: GPUBindGroup;

let gpuInitialized = false;

export const getCanvasSize = () => ({ width, height });
export const getWholeCanvasRect = () => ({ x: 0, y: 0, width, height });

export const initRenderer = (w: number, h: number) => {
  // TODO: あとでmaxSizeを変えられるようにする
  const resolutionLimit = 134217728 / 32 / 4; // default storage buffer maximum size = 128MiB, iteration = Uint32, For x2 super sampling = 4
  if (w * h > resolutionLimit) {
    const msg = `Resolution is too high: ${w}x${h}`;
    window.alert(msg);
    throw new Error(msg);
  }

  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };
  unifiedIterationBuffer = new Uint32Array(w * h * 4);
  paletteData = new Float32Array(8192 * 4); // 先に最大サイズ分確保しておく（手抜き）

  try {
    initializeGPU();
  } catch (e) {
    console.error(e);
    window.alert("Failed to initialize WebGPU. Please reload the page.");
  }
};

export const renderToCanvas = (
  x: number,
  y: number,
  width?: number,
  height?: number,
  unifiedIterationBuffer?: Uint32Array,
) => {
  if (!gpuInitialized) return;

  const params = getCurrentParams();
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();
  const palette = getCurrentPalette();

  const uniformData = new Uint32Array([
    params.N, // maxIteration
    canvasWidth, // width
    canvasHeight, // height
    palette.offset, // paletteOffset
    palette.length, // paletteSize
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  if (unifiedIterationBuffer) {
    device.queue.writeBuffer(iterationBuffer, 0, unifiedIterationBuffer);
  }

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue: { r: 0, g: 0, b: 0.4, a: 1 },
        storeOp: "store",
      },
    ],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(vertices.length / 2);
  pass.end();

  device.queue.submit([encoder.finish()]);
};

export const addIterationBuffer = (
  rect: Rect = bufferRect,
  iterBuffer?: IterationBuffer[],
) => {
  if (!gpuInitialized) return;
};

export const resizeCanvas = (requestWidth: number, requestHeight: number) => {
  if (!gpuInitialized) return;

  const gpuCanvas = document.getElementById("gpu-canvas")! as HTMLCanvasElement;

  gpuCanvas.width = requestWidth;
  gpuCanvas.height = requestHeight;

  // TODO: ここでcontextの再設定とか
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

const initializeGPU = async () => {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
  }

  device = await adapter.requestDevice();
  const gpuCanvas = document.getElementById("gpu-canvas")! as HTMLCanvasElement;

  context = gpuCanvas.getContext("webgpu")!;
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

  const shaderModule = device.createShaderModule({
    label: "Mandelbrot set shader",
    code: shaderCode,
  });

  uniformBuffer = device.createBuffer({
    label: "uniform buffer",
    size: 32, // uint32 * 5 だけど16の倍数にしとく
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  iterationBuffer = device.createBuffer({
    label: "iteration buffer",
    size: unifiedIterationBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  paletteBuffer = device.createBuffer({
    label: "palette buffer",
    size: paletteData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    label: "Mandelbrot BindGroupLayout",
    entries: [
      {
        // uniform
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        // iterations
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
      {
        // palette
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

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
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    label: "Mandelbrot Pipeline Layout",
    bindGroupLayouts: [bindGroupLayout],
  });

  pipeline = device.createRenderPipeline({
    label: "Mandelbrot set pipeline",
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: canvasFormat }],
    },
  });

  setPalette();

  gpuInitialized = true;
  console.log("WebGPU initialized!");
};
