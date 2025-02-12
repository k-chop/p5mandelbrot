import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getStore } from "@/store/store";
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
 * canvasのサイズをcontainerのサイズと最大サイズ設定見て初期化する
 */
export const initializeCanvasSize = () => {
  const elm = document.getElementById("canvas-wrapper");
  let w = 800;
  let h = 800;

  const maxCanvasSize = getStore("maxCanvasSize");

  if (elm) {
    w = elm.clientWidth;
    h = elm.clientHeight;
  }

  width = maxCanvasSize === -1 ? w : Math.min(w, maxCanvasSize);
  height = maxCanvasSize === -1 ? h : Math.min(h, maxCanvasSize);

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
export const resizeCamera = (
  p: p5,
  requestWidth: number,
  requestHeight: number,
) => {
  const from = getCanvasSize();
  console.debug(
    `Request resize canvas to w=${requestWidth} h=${requestHeight}, from w=${from.width} h=${from.height}`,
  );

  const maxSize = getStore("maxCanvasSize");

  const w = maxSize === -1 ? requestWidth : Math.min(requestWidth, maxSize);
  const h = maxSize === -1 ? requestHeight : Math.min(requestHeight, maxSize);

  console.debug(`Resize to: w=${w}, h=${h} (maxCanvasSize=${maxSize})`);

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
