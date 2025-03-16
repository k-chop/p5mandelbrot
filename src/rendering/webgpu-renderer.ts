import type { Rect } from "@/math/rect";
import type { IterationBuffer } from "@/types";

let width: number;
let height: number;

let bufferRect: Rect;

let unifiedIterationBuffer: Uint32Array;

let device: GPUDevice;
let context: GPUCanvasContext;

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
) => {
  if (!gpuInitialized) return;

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

  gpuInitialized = true;
  console.log("WebGPU initialized!");
};
