import p5 from "p5";
import { getCurrentParams } from "./mandelbrot";
import { Rect } from "./rect";
import { getIterationCache } from "./aggregator";
import { renderIterationsToPixel } from "./rendering";
import { Palette } from "./color";

let mainBuffer: p5.Graphics;
let resultBuffer: p5.Graphics;

let width: number;
let height: number;

let bufferRect: Rect;
let lastColorIdx = 0;
let currentColorIdx = 0;
let palettes: Palette[] = [];

const colorChanged = () => {
  return lastColorIdx !== currentColorIdx;
};

const updateColor = () => {
  lastColorIdx = currentColorIdx;
};

export const redraw = () => {
  lastColorIdx = -1;
};

export const addPalettes = (...plts: Palette[]) => {
  palettes.push(...plts);
};

export const setColorIndex = (index: number) => {
  if (palettes[index]) {
    currentColorIdx = index;
  } else {
    currentColorIdx = 0;
  }
};

export const getPalette = () => palettes[currentColorIdx];

export const getCanvasWidth = () => width;

export const setupCamera = (p: p5, w: number, h: number) => {
  mainBuffer = p.createGraphics(w, h);
  resultBuffer = p.createGraphics(w, h);
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

export const nextResultBuffer = (p: p5): p5.Graphics => {
  return resultBuffer;
};

export const clearResultBuffer = () => {
  // @ts-ignore
  resultBuffer.clear();
};

export const renderToMainBuffer = (rect: Rect) => {
  const params = getCurrentParams();

  renderIterationsToPixel(
    rect,
    mainBuffer,
    params.N,
    getIterationCache(),
    getPalette(),
  );
};

export const renderToResultBuffer = (rect: Rect) => {
  const params = getCurrentParams();

  renderIterationsToPixel(
    rect,
    resultBuffer,
    params.N,
    getIterationCache(),
    getPalette(),
  );
};

export const mergeToMainBuffer = () => {
  mainBuffer.image(resultBuffer, 0, 0);
  clearResultBuffer();
};
