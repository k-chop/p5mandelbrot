import p5 from "p5";
import { renderIterationToPixel } from "./color";
import {
  colorChanged,
  updateColor,
  getIterationTimes,
  getPalette,
  getCurrentParams,
} from "./mandelbrot";
import { Rect } from "./rect";

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
};

export const nextBuffer = (p: p5): p5.Graphics => {
  if (colorChanged()) {
    updateColor();

    renderToMainBuffer(bufferRect);
  }

  return mainBuffer;
};

export const renderToMainBuffer = (rect: Rect) => {
  const params = getCurrentParams();

  renderIterationToPixel(
    rect,
    mainBuffer,
    params.N,
    getIterationTimes(),
    getPalette()
  );
};
