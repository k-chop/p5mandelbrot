import p5 from "p5";
import { recolor } from "./color";
import {
  shouldDrawCompletedArea,
  shouldDrawColorChanged,
  updateColor,
  getIterationTimes,
  getPalette,
  getCurrentParams,
} from "./mandelbrot";

let mainBuffer: p5.Graphics;

let width: number;
let height: number;

export const setupCamera = (p: p5, w: number, h: number) => {
  mainBuffer = p.createGraphics(w, h);
  width = w;
  height = h;
};

export const nextBuffer = (p: p5): p5.Graphics => {
  if (shouldDrawCompletedArea() || shouldDrawColorChanged()) {
    updateColor();

    renderToMainBuffer(p);
  }

  return mainBuffer;
};

export const renderToMainBuffer = (p: p5) => {
  const params = getCurrentParams();

  recolor(
    width,
    height,
    mainBuffer,
    params.N,
    getIterationTimes(),
    getPalette()
  );
};
