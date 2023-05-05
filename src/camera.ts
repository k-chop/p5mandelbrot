import p5 from "p5";
import { getCurrentParams } from "./mandelbrot";
import { Rect } from "./rect";
import { getIterationCache } from "./aggregator";
import { renderIterationsToPixel } from "./rendering";
import { Palette } from "./color";

let mainBuffer: p5.Graphics;

let width: number;
let height: number;

let bufferRect: Rect;
let lastColorIdx = 0;
let currentColorIdx = 0;
let palettes: Palette[];

const colorChanged = () => {
  return lastColorIdx !== currentColorIdx;
};

const updateColor = () => {
  lastColorIdx = currentColorIdx;
};

export const setPalettes = (plts: Palette[]) => {
  palettes = plts;
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

  renderIterationsToPixel(
    rect,
    mainBuffer,
    params.N,
    getIterationCache(),
    getPalette()
  );
};
