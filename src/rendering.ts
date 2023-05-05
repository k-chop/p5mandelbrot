import p5 from "p5";
import { getCanvasWidth } from "./camera";
import { GLITCHED_POINT_ITERATION } from "./mandelbrot";
import { Rect } from "./rect";
import { IterationBuffer } from "./types";

export const fillColor = (
  x: number,
  y: number,
  canvasWidth: number,
  pixels: Uint8ClampedArray,
  palette: Uint8ClampedArray,
  iteration: number,
  maxIteration: number,
  density: number
) => {
  for (let i = 0; i < density; i++) {
    for (let j = 0; j < density; j++) {
      const pixelIndex =
        4 * ((y * density + j) * canvasWidth * density + (x * density + i));

      // iterationが-1のときはglitchが起きているので白で塗りつぶす
      if (iteration === GLITCHED_POINT_ITERATION) {
        pixels[pixelIndex + 0] = 255;
        pixels[pixelIndex + 1] = 255;
        pixels[pixelIndex + 2] = 255;
        pixels[pixelIndex + 3] = 255;
      } else if (iteration !== maxIteration) {
        const paletteIdx = (iteration % (palette.length / 4)) * 4;
        pixels[pixelIndex + 0] = palette[paletteIdx + 0];
        pixels[pixelIndex + 1] = palette[paletteIdx + 1];
        pixels[pixelIndex + 2] = palette[paletteIdx + 2];
        pixels[pixelIndex + 3] = palette[paletteIdx + 3];
      } else {
        pixels[pixelIndex + 0] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 255;
      }
    }
  }
};

export const bufferLocalLogicalIndex = (
  x: number,
  y: number,
  rect: Rect
): number => x - rect.x + (y - rect.y) * rect.width;

export const renderIterationsToPixel = (
  worldRect: Rect,
  graphics: p5.Graphics,
  maxIteration: number,
  iterationsResult: IterationBuffer[],
  palette: Uint8ClampedArray
) => {
  const canvasWidth = getCanvasWidth();

  graphics.loadPixels();
  const density = graphics.pixelDensity();

  for (const iteration of iterationsResult) {
    const { rect, buffer } = iteration;

    // worldRectとiterationのrectが一致する箇所だけ描画する
    const startY = Math.max(rect.y, worldRect.y);
    const startX = Math.max(rect.x, worldRect.x);
    const endY = Math.min(rect.y + rect.height, worldRect.y + worldRect.height);
    const endX = Math.min(rect.x + rect.width, worldRect.x + worldRect.width);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        // バッファ内で対応する点のiterationを取得
        const idx = bufferLocalLogicalIndex(x, y, rect);
        const n = buffer[idx];

        const pixels = graphics.pixels as unknown as Uint8ClampedArray;
        fillColor(x, y, canvasWidth, pixels, palette, n, maxIteration, density);
      }
    }
  }

  graphics.updatePixels();
};
