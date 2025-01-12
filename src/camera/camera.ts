import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import type { IterationBuffer } from "@/types";
import p5 from "p5";
import { getIterationCache } from "../aggregator/aggregator";
import { Rect } from "../rect";
import { renderIterationsToPixel } from "../rendering/rendering";
import { getCurrentPalette, markAsRendered, needsRerender } from "./palette";

let mainBuffer: p5.Graphics;

let width: number;
let height: number;

let bufferRect: Rect;

export const getCanvasWidth = () => width;

export const setupCamera = (p: p5, w: number, h: number) => {
  mainBuffer = p.createGraphics(w, h);
  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };

  console.log("Camera setup done", { width, height });
};

export const nextBuffer = (_p: p5): p5.Graphics => {
  if (needsRerender()) {
    markAsRendered();

    renderToMainBuffer();
  }

  return mainBuffer;
};

export const renderToMainBuffer = (
  rect: Rect = bufferRect,
  iterBuffer?: IterationBuffer[],
) => {
  const params = getCurrentParams();

  renderIterationsToPixel(
    rect,
    mainBuffer,
    params.N,
    iterBuffer ?? getIterationCache(),
    getCurrentPalette(),
  );
};

export const clearMainBuffer = () => {
  mainBuffer.clear();
};
