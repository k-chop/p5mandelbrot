import p5 from "p5";

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
  index: number,
  pixels: Uint8ClampedArray,
  palette: Uint8ClampedArray,
  iteration: number,
  maxIteration: number
) => {
  const pixelIndex = index * 4;

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
};

export const recolor = (
  p: p5,
  buffer: p5.Graphics,
  maxIteration: number,
  iterationsResult: Uint32Array,
  palette: Uint8ClampedArray
) => {
  buffer.background(0);
  buffer.loadPixels();

  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const index = x + y * p.width;
      const n = iterationsResult[index];

      const pixels = buffer.pixels as unknown as Uint8ClampedArray;
      fillColor(index, pixels, palette, n, maxIteration);
    }
  }

  buffer.updatePixels();
};
