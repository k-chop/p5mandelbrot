import p5 from "p5";
import { Rect } from "./rect";
import { getCanvasWidth } from "./camera";
import { IterationBuffer } from "./types";

type ColorMapper = {
  size: number;
  f: (p: p5, n: number, offset?: number) => p5.Color;
};

export const posterize = (
  p: p5,
  value: number,
  numberOfTones: number,
  lower: number,
  upper: number
) => {
  const paletteLength = numberOfTones * 2;
  const v = value % paletteLength;

  if (v < numberOfTones) {
    return p.map(Math.floor(v % numberOfTones), 0, numberOfTones, lower, upper);
  } else {
    return p.map(Math.floor(v % numberOfTones), 0, numberOfTones, upper, lower);
  }
};

const colors: ColorMapper[] = [
  {
    size: 256,
    f: (p, n) => {
      // hue 0~360
      const hue = posterize(p, n, 128, 0, 360);
      return p.color(hue, 75, 100);
    },
  },
  {
    size: 256,
    f: (p, n) => {
      // monochrome
      const brightness = posterize(p, n, 128, 20, 100);
      return p.color(0, 0, brightness);
    },
  },
  {
    size: 256,
    f: (p, n) => {
      // fire
      const brightness = posterize(p, n, 128, 30, 100);
      const hue = posterize(p, n, 128, -30, 60);
      return p.color(hue, 90, brightness);
    },
  },
];

export const buildColors = (p: p5) => {
  const result: Uint8ClampedArray[] = [];

  colors.forEach((colorMapper) => {
    const array = new Uint8ClampedArray(colorMapper.size * 4);

    for (let i = 0; i < colorMapper.size; i++) {
      const color = colorMapper.f(p, i);
      const idx = i * 4;
      array[idx + 0] = p.red(color);
      array[idx + 1] = p.green(color);
      array[idx + 2] = p.blue(color);
      array[idx + 3] = 255;
    }

    result.push(array);
  });

  return result;
};

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

      if (iteration !== maxIteration) {
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

const calcLogicalIndex = (x: number, y: number, width: number): number =>
  x + y * width;

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

    // FIXME: たぶん先にworldRectとiterationのrectが交差するか確認した方がいい
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      // 描画範囲外
      if (y < worldRect.y || worldRect.y + worldRect.height < y) continue;

      for (let x = rect.x; x < rect.x + rect.width; x++) {
        // 描画範囲外
        if (x < worldRect.x || worldRect.x + worldRect.width < x) continue;
        // バッファ内で対応する点のiterationを取得
        const bufferLocalLogicalIndex = calcLogicalIndex(
          x - rect.x,
          y - rect.y,
          rect.width
        );
        const n = buffer[bufferLocalLogicalIndex];

        const pixels = graphics.pixels as unknown as Uint8ClampedArray;
        fillColor(x, y, canvasWidth, pixels, palette, n, maxIteration, density);
      }
    }
  }

  graphics.updatePixels();
};
