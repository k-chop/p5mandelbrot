import p5 from "p5";
import { getIterationCache } from "../aggregator";
import { getCurrentParams } from "../mandelbrot";
import { Rect } from "../rect";
import { renderIterationsToPixel } from "../rendering";
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

    renderToMainBuffer(bufferRect);
  }

  return mainBuffer;
};

export const renderToMainBuffer = (rect: Rect) => {
  const params = getCurrentParams();

  renderIterationsToPixel(
    rect,
    mainBuffer,
    params.N,
    getIterationCache(),
    getCurrentPalette(),
  );
};

export const clearMainBuffer = () => {
  mainBuffer.clear();
};
