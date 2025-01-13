import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import type { IterationBuffer } from "@/types";
import p5 from "p5";
import {
  getIterationCache,
  scaleIterationCacheAroundPoint,
  setIterationCache,
  translateRectInIterationCache,
} from "../iteration-buffer/iteration-buffer";
import { Rect } from "../math/rect";
import { renderIterationsToPixel } from "../rendering/rendering";
import {
  getCurrentPalette,
  markAsRendered,
  markNeedsRerender,
  needsRerender,
} from "./palette";

let mainBuffer: p5.Graphics;

let width: number;
let height: number;

let bufferRect: Rect;

/**
 * FIXME: responsiveにするときに任意の値で初期化できるようにする
 */
export const initializeCanvasSize = (w: number = 800, h: number = 800) => {
  width = w;
  height = h;

  return { width, height };
};
export const getCanvasSize = () => ({ width, height });
export const getWholeCanvasRect = () => ({ x: 0, y: 0, width, height });

export const setupCamera = (p: p5, w: number, h: number) => {
  mainBuffer = p.createGraphics(w, h);
  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };

  console.log("Camera setup done", { width, height });
};

/**
 * 画面サイズが変わったときに呼ぶ
 *
 * やること
 * - canvasのリサイズ
 * - mainBufferのリサイズ
 * - cacheの位置変更（できれば）
 */
export const resizeCamera = (p: p5, w: number, h: number) => {
  const from = getCanvasSize();
  console.debug(
    `Resize canvas to x=${w} y=${h}, from x=${from.width} y=${from.height}`,
  );

  p.resizeCanvas(w, h);

  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };

  mainBuffer.resizeCanvas(width, height);
  clearMainBuffer();

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
  renderToMainBuffer();

  markNeedsRerender();
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
