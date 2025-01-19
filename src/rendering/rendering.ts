import { Palette } from "@/color";
import { clamp } from "@/math/util";
import p5 from "p5";
import { getCanvasSize } from "../camera/camera";
import { Rect } from "../math/rect";
import { IterationBuffer } from "../types";

/** GLITCHEDな場合に設定するiteration count値 */
export const GLITCHED_POINT_ITERATION = 4294967295;

export interface Resolution {
  width: number;
  height: number;
}

/**
 * 指定した座標をpaletteとiterationの値に応じて塗りつぶす
 *
 * retina対応
 */
export const fillColor = (
  x: number,
  y: number,
  canvasWidth: number,
  pixels: Uint8ClampedArray,
  palette: Palette,
  buffer: Uint32Array,
  indexes: number[],
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

      if (indexes.length === 1) {
        r = palette.r(buffer[indexes[0]]);
        g = palette.g(buffer[indexes[0]]);
        b = palette.b(buffer[indexes[0]]);
      } else {
        const colors = indexes.map((idx) => [
          palette.r(buffer[idx]),
          palette.g(buffer[idx]),
          palette.b(buffer[idx]),
        ]);
        [r, g, b] = colors
          .reduce(
            (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
            [0, 0, 0],
          )
          .map((c) => Math.round(c / indexes.length));
      }

      // iterationの平均がmaxIterationのときに黒にする
      const iterations = indexes.map((idx) => buffer[idx]);
      const iteration = Math.round(
        iterations.reduce((acc, cur) => acc + cur, 0) / iterations.length,
      );

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

/**
 * rect内のローカル座標系(resolution)でのindexを取得する
 *
 * worldX,Yはrectの中に収まっている前提
 */
export const bufferLocalLogicalIndex = (
  worldX: number,
  worldY: number,
  rect: Rect,
  resolution: Resolution,
  isSuperSampled = false,
): number[] => {
  const localX = worldX - rect.x;
  const localY = worldY - rect.y;

  const ratioX = resolution.width / rect.width;
  const ratioY = resolution.height / rect.height;

  const scaledX = Math.floor(localX * ratioX);
  const scaledY = Math.floor(localY * ratioY);

  if (!isSuperSampled) {
    return [scaledX + scaledY * resolution.width];
  } else {
    const idx00 = scaledX + scaledY * resolution.width;
    const idx10 = scaledX + 1 + scaledY * resolution.width;
    const idx01 = scaledX + (scaledY + 1) * resolution.width;
    const idx11 = scaledX + 1 + (scaledY + 1) * resolution.width;
    return [idx00, idx10, idx01, idx11];
  }
};

export const renderIterationsToPixel = (
  worldRect: Rect,
  graphics: p5.Graphics,
  maxIteration: number,
  iterationsResult: IterationBuffer[],
  palette: Palette,
) => {
  const { width: canvasWidth } = getCanvasSize();

  graphics.loadPixels();
  const density = graphics.pixelDensity();

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

        const indexes = bufferLocalLogicalIndex(
          worldX,
          worldY,
          rect,
          resolution,
          isSuperSampled,
        );

        const pixels = graphics.pixels as unknown as Uint8ClampedArray;
        fillColor(
          worldX,
          worldY,
          canvasWidth,
          pixels,
          palette,
          buffer,
          indexes,
          maxIteration,
          density,
        );
      }
    }
  }

  graphics.updatePixels();
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
