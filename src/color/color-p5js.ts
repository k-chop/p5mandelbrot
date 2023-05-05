import p5 from "p5";
import { ColorBuilder, Palette, RGB } from ".";

type ColorMapper = {
  size: number;
  f: (p: p5, n: number, offset?: number) => p5.Color;
};

const posterize = (
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

export const buildColors: ColorBuilder = (p: p5) => {
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

const extractRGB = (p: p5, color: p5.Color): RGB => {
  return [p.red(color), p.green(color), p.blue(color)] satisfies RGB;
};

class P5JsPalette implements Palette {
  private p5Instance: p5;

  private offsetIndex = 0;
  private mirrored = true;
  private colorLength: number;

  private f: (index: number) => p5.Color;

  constructor(p: p5, colorLength: number, f: (index: number) => p5.Color) {
    this.p5Instance = p;
    this.colorLength = colorLength;
    this.f = f;
  }

  rgb(index: number): RGB {
    const p = this.p5Instance;

    if (this.mirrored) {
      // 折り返す
      const length = this.colorLength * 2;
      const offsettedIndex = (index + this.offsetIndex) % length;

      const idx =
        offsettedIndex < this.colorLength
          ? offsettedIndex
          : length - offsettedIndex - 1;

      const color = this.p5Instance.color(this.f(idx));
      const rgb = extractRGB(p, color);
      return rgb;
    } else {
      // そのまま
      const offsettedIndex = (index + this.offsetIndex) % this.colorLength;
      const color = this.p5Instance.color(this.f(offsettedIndex));
      const rgb = extractRGB(p, color);
      return rgb;
    }
  }
  size(): number {
    return this.mirrored ? this.colorLength * 2 : this.colorLength;
  }
  setOffset(offsetIndex: number): void {
    this.offsetIndex = offsetIndex;
  }
  setLength(length: number): void {
    this.colorLength = length;
  }
  setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
  }
}

export const p5jsPalettes = (p: p5) => [
  new P5JsPalette(p, 128, (i) => {
    // hue 0~360
    const hue = posterize(p, i, 128, 0, 360);
    return p.color(hue, 75, 100);
  }),
  new P5JsPalette(p, 128, (i) => {
    // monochrome
    const brightness = posterize(p, i, 128, 20, 100);
    return p.color(0, 0, brightness);
  }),
  new P5JsPalette(p, 128, (i) => {
    // fire
    const brightness = posterize(p, i, 128, 30, 100);
    const hue = posterize(p, i, 128, -30, 60);
    return p.color(hue, 90, brightness);
  }),
];
