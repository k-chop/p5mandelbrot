import {
  getCurrentPalette,
  markAsRendered,
  markNeedsRerender,
  needsRerender,
} from "@/camera/palette";
import { Palette } from "@/color";
import {
  getIterationCache,
  scaleIterationCacheAroundPoint,
  setIterationCache,
  translateRectInIterationCache,
} from "@/iteration-buffer/iteration-buffer";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { clamp } from "@/math/util";
import { getStore } from "@/store/store";
import p5 from "p5";
import { Rect } from "../math/rect";
import { IterationBuffer } from "../types";

export interface Resolution {
  width: number;
  height: number;
}

let p5Instance: p5;

let mainBuffer: p5.Graphics;

let width: number;
let height: number;

let bufferRect: Rect;

let unifiedIterationBuffer: Uint32Array;

export const getCanvasSize = () => ({ width, height });
export const getWholeCanvasRect = () => ({ x: 0, y: 0, width, height });

export const initRenderer = (w: number, h: number, p5: p5) => {
  p5Instance = p5;

  mainBuffer = p5.createGraphics(w, h);
  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };
  unifiedIterationBuffer = new Uint32Array(w * h);

  console.log("Camera setup done", { width, height });
};

export const renderToCanvas = (
  x: number,
  y: number,
  width?: number,
  height?: number,
) => {
  if (needsRerender()) {
    markAsRendered();
    renderToMainBuffer();
  }

  const buffer = mainBuffer;
  p5Instance.clear();
  p5Instance.image(buffer, x, y, width, height);
};

export const addIterationBuffer = (
  rect: Rect = bufferRect,
  iterBuffer?: IterationBuffer[],
) => {
  renderIterationsToUnifiedBuffer(
    rect,
    unifiedIterationBuffer,
    iterBuffer ?? getIterationCache(),
  );
  markNeedsRerender();
};

/**
 * 画面サイズが変わったときに呼ぶ
 *
 * やること
 * - canvasのリサイズ
 * - mainBufferのリサイズ
 * - cacheの位置変更（できれば）
 */
export const resizeCanvas = (requestWidth: number, requestHeight: number) => {
  const from = getCanvasSize();
  console.debug(
    `Request resize canvas to w=${requestWidth} h=${requestHeight}, from w=${from.width} h=${from.height}`,
  );

  const maxSize = getStore("maxCanvasSize");

  const w = maxSize === -1 ? requestWidth : Math.min(requestWidth, maxSize);
  const h = maxSize === -1 ? requestHeight : Math.min(requestHeight, maxSize);

  console.debug(`Resize to: w=${w}, h=${h} (maxCanvasSize=${maxSize})`);

  p5Instance.resizeCanvas(w, h);

  width = w;
  height = h;
  bufferRect = { x: 0, y: 0, width: w, height: h };

  unifiedIterationBuffer = new Uint32Array(w * h * 4);
  mainBuffer.resizeCanvas(width, height);

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
  addIterationBuffer();

  markNeedsRerender();
};

/**
 * ドラッグ中のクロスヘア描画
 */
export const drawCrossHair = (p: p5) => {
  const length = 10;

  const centerX = Math.floor(p.width / 2);
  const centerY = Math.floor(p.height / 2);

  // FIXME: たぶんカラーパレットを見て目立つ色を選ぶべき

  p.strokeWeight(2);

  p.stroke(p.color(0, 0, 100));
  p.line(centerX - length, centerY, centerX + length, centerY);
  p.line(centerX, centerY - length, centerX, centerY + length);

  p.stroke(p.color(0, 0, 0));
  p.line(centerX - length / 2, centerY, centerX + length / 2, centerY);
  p.line(centerX, centerY - length / 2, centerX, centerY + length / 2);
};

/**
 * カーソル位置に倍率を表示
 *
 * interactive zoom中に表示する
 */
export const drawScaleRate = (p: p5, scaleFactor: number) => {
  p.fill(255);
  p.stroke(0);
  p.strokeWeight(4);
  p.textSize(14);

  const { text, size } = scaleRateText(scaleFactor);

  const x = clamp(p.mouseX, 0, p.width - size);
  const y = clamp(p.mouseY, 0, p.height - 25);

  p.text(`${text}`, x + 10, y + 20);
};

/**
 * 指定した座標をpaletteとiterationの値に応じて塗りつぶす
 *
 * retina対応
 */
const fillColor = (
  x: number,
  y: number,
  canvasWidth: number,
  pixels: Uint8ClampedArray,
  palette: Palette,
  buffer: Uint32Array,
  isSuperSampled: boolean,
  maxIteration: number,
  density: number,
) => {
  for (let i = 0; i < density; i++) {
    for (let j = 0; j < density; j++) {
      const pixelIndex = Math.floor(
        4 * ((y * density + j) * canvasWidth * density + (x * density + i)),
      );

      let r = 0;
      let g = 0;
      let b = 0;

      let iteration = 0;

      if (!isSuperSampled) {
        const idx = x * density + i + (y * density + j) * canvasWidth * density;
        iteration = buffer[idx];

        r = palette.r(buffer[idx]);
        g = palette.g(buffer[idx]);
        b = palette.b(buffer[idx]);
      } else {
        const doubleCanvasWidth = canvasWidth * 2;
        const y2 = y * 2;
        const x2 = x * 2;

        const idx00 = x2 + i + (y2 + j) * doubleCanvasWidth;
        const idx10 = x2 + i + 1 + (y2 + j) * doubleCanvasWidth;
        const idx01 = x2 + i + (y2 + j + 1) * doubleCanvasWidth;
        const idx11 = x2 + i + 1 + (y2 + j + 1) * doubleCanvasWidth;

        iteration = Math.round(
          (buffer[idx00] + buffer[idx10] + buffer[idx01] + buffer[idx11]) / 4,
        );

        const r00 = palette.r(buffer[idx00]);
        const g00 = palette.g(buffer[idx00]);
        const b00 = palette.b(buffer[idx00]);

        const r10 = palette.r(buffer[idx10]);
        const g10 = palette.g(buffer[idx10]);
        const b10 = palette.b(buffer[idx10]);

        const r01 = palette.r(buffer[idx01]);
        const g01 = palette.g(buffer[idx01]);
        const b01 = palette.b(buffer[idx01]);

        const r11 = palette.r(buffer[idx11]);
        const g11 = palette.g(buffer[idx11]);
        const b11 = palette.b(buffer[idx11]);

        r = (r00 + r10 + r01 + r11) / 4;
        g = (g00 + g10 + g01 + g11) / 4;
        b = (b00 + b10 + b01 + b11) / 4;
      }

      if (iteration !== maxIteration) {
        pixels[pixelIndex + 0] = r;
        pixels[pixelIndex + 1] = g;
        pixels[pixelIndex + 2] = b;
        pixels[pixelIndex + 3] = 255;
      } else {
        pixels[pixelIndex + 0] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 255;
      }
    }
  }
};

const renderIterationsToPixel = (
  worldRect: Rect,
  graphics: p5.Graphics,
  maxIteration: number,
  unifiedIterationBuffer: Uint32Array,
  isSuperSampled: boolean = false,
  palette: Palette,
) => {
  const { width: canvasWidth } = getCanvasSize();

  graphics.loadPixels();
  const density = graphics.pixelDensity();

  // worldRectとiterationのrectが重なっている部分だけ描画する
  const startY = worldRect.y;
  const startX = worldRect.x;
  const endY = worldRect.y + worldRect.height;
  const endX = worldRect.x + worldRect.width;

  for (let worldY = startY; worldY < endY; worldY++) {
    for (let worldX = startX; worldX < endX; worldX++) {
      const pixels = graphics.pixels as unknown as Uint8ClampedArray;

      fillColor(
        worldX,
        worldY,
        canvasWidth,
        pixels,
        palette,
        unifiedIterationBuffer,
        isSuperSampled,
        maxIteration,
        density,
      );
    }
  }

  graphics.updatePixels();
};

/**
 * canvasのpixelサイズと同サイズのBufferにiteration数を書き込む
 *
 * supersamplingされている場合もある
 */
const renderIterationsToUnifiedBuffer = (
  worldRect: Rect,
  unifiedIterationBuffer: Uint32Array,
  iterationsResult: IterationBuffer[],
) => {
  const { width: canvasWidth } = getCanvasSize();

  for (const iteration of iterationsResult) {
    const { rect, buffer, resolution, isSuperSampled } = iteration;

    // worldRectとiterationのrectが重なっている部分だけ描画する
    const startY = Math.max(rect.y, worldRect.y);
    const startX = Math.max(rect.x, worldRect.x);
    const endY = Math.min(rect.y + rect.height, worldRect.y + worldRect.height);
    const endX = Math.min(rect.x + rect.width, worldRect.x + worldRect.width);

    for (let worldY = startY; worldY < endY; worldY++) {
      for (let worldX = startX; worldX < endX; worldX++) {
        // バッファ内で対応する点のiterationを取得
        const localX = worldX - rect.x;
        const localY = worldY - rect.y;

        const ratioX = resolution.width / rect.width;
        const ratioY = resolution.height / rect.height;

        const scaledX = Math.floor(localX * ratioX);
        const scaledY = Math.floor(localY * ratioY);

        const worldIdx = worldY * canvasWidth + worldX;

        if (!isSuperSampled) {
          const idx = scaledX + scaledY * resolution.width;

          unifiedIterationBuffer[worldIdx] = buffer[idx];
        } else {
          const idx00 = scaledX + scaledY * resolution.width;
          const idx10 = scaledX + 1 + scaledY * resolution.width;
          const idx01 = scaledX + (scaledY + 1) * resolution.width;
          const idx11 = scaledX + 1 + (scaledY + 1) * resolution.width;

          // unifiedIterationBufferは幅・高さともに2倍のサイズを想定
          const doubleCanvasWidth = canvasWidth * 2;
          const worldY2x = worldY * 2;
          const worldX2x = worldX * 2;

          // 4点のデータを対応する位置にそのまま格納
          unifiedIterationBuffer[worldY2x * doubleCanvasWidth + worldX2x] =
            buffer[idx00];
          unifiedIterationBuffer[
            worldY2x * doubleCanvasWidth + (worldX2x + 1)
          ] = buffer[idx10];
          unifiedIterationBuffer[
            (worldY2x + 1) * doubleCanvasWidth + worldX2x
          ] = buffer[idx01];
          unifiedIterationBuffer[
            (worldY2x + 1) * doubleCanvasWidth + (worldX2x + 1)
          ] = buffer[idx11];
        }
      }
    }
  }
};

const renderToMainBuffer = (rect: Rect = bufferRect) => {
  const params = getCurrentParams();

  renderIterationsToPixel(
    rect,
    mainBuffer,
    params.N,
    unifiedIterationBuffer,
    params.isSuperSampling,
    getCurrentPalette(),
  );
};

const scaleRateText = (scaleFactor: number) => {
  if (scaleFactor < 10) {
    return { text: `x${scaleFactor.toFixed(2)}`, size: 60 };
  } else if (scaleFactor < 100) {
    return { text: `x${scaleFactor.toFixed(1)}`, size: 60 };
  } else {
    // 100~
    const text = `x${Math.round(scaleFactor)}`;
    return { text, size: text.length * 10 + 8 };
  }
};
