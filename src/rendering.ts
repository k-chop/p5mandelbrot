import p5 from "p5";
import { getCanvasWidth } from "./camera";
import { Palette } from "./color";
import { GLITCHED_POINT_ITERATION } from "./mandelbrot";
import { Rect } from "./rect";
import { IterationBuffer, Resolution } from "./types";

export const fillColor = (
  x: number,
  y: number,
  canvasWidth: number,
  pixels: Uint8ClampedArray,
  palette: Palette,
  iteration: number,
  maxIteration: number,
  density: number,
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
        const r = palette.r(iteration);
        const g = palette.g(iteration);
        const b = palette.b(iteration);

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

export const bufferLocalLogicalIndex = (
  worldX: number,
  worldY: number,
  rect: Rect,
  resolution: Resolution,
): number => {
  const localX = worldX - rect.x;
  const localY = worldY - rect.y;

  const ratioX = resolution.width / rect.width;
  const ratioY = resolution.height / rect.height;

  const scaledX = Math.floor(localX * ratioX);
  const scaledY = Math.floor(localY * ratioY);

  return scaledX + scaledY * resolution.width;
};

export const renderIterationsToPixel = (
  worldRect: Rect,
  graphics: p5.Graphics,
  maxIteration: number,
  iterationsResult: IterationBuffer[],
  palette: Palette,
) => {
  const canvasWidth = getCanvasWidth();

  graphics.loadPixels();
  const density = graphics.pixelDensity();

  for (const iteration of iterationsResult) {
    const { rect, buffer, resolution } = iteration;

    // worldRectとiterationのrectが一致する箇所だけ描画する
    const startY = Math.max(rect.y, worldRect.y);
    const startX = Math.max(rect.x, worldRect.x);
    const endY = Math.min(rect.y + rect.height, worldRect.y + worldRect.height);
    const endX = Math.min(rect.x + rect.width, worldRect.x + worldRect.width);

    for (let worldY = startY; worldY < endY; worldY++) {
      for (let worldX = startX; worldX < endX; worldX++) {
        // バッファ内で対応する点のiterationを取得

        const idx = bufferLocalLogicalIndex(worldX, worldY, rect, resolution);
        const n = buffer[idx];

        const pixels = graphics.pixels as unknown as Uint8ClampedArray;
        fillColor(
          worldX,
          worldY,
          canvasWidth,
          pixels,
          palette,
          n,
          maxIteration,
          density,
        );
      }
    }
  }

  graphics.updatePixels();
};

export const drawCrossHair = (p: p5) => {
  const length = 10;

  const centerX = Math.floor(p.width / 2);
  const centerY = Math.floor(p.height / 2);

  // FIXME: たぶんカラーパレットを見て目立つ色を選ぶべき

  p.stroke(p.color(0, 0, 100));
  p.line(centerX - length, centerY, centerX + length, centerY);
  p.line(centerX, centerY - length, centerX, centerY + length);

  p.stroke(p.color(0, 0, 0));
  p.line(centerX - length / 2, centerY, centerX + length / 2, centerY);
  p.line(centerX, centerY - length / 2, centerX, centerY + length / 2);
};
