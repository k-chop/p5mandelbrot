import p5 from "p5";
import { Palette, RGB } from ".";

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

const extractRGB = (p: p5, color: p5.Color): RGB => {
  return [p.red(color), p.green(color), p.blue(color)] satisfies RGB;
};

class P5JsPalette implements Palette {
  private p5Instance: p5;
  private cache: Uint8ClampedArray;
  private cacheInitialized: boolean[];

  private offsetIndex = 0;
  private mirrored = true;
  private colorLength: number;

  private f: (index: number) => p5.Color;

  constructor(p: p5, colorLength: number, f: (index: number) => p5.Color) {
    this.p5Instance = p;
    this.colorLength = colorLength;
    this.f = f;

    this.cache = new Uint8ClampedArray(this.colorLength * 3);
    this.cacheInitialized = new Array(this.colorLength).fill(false);
  }

  rgb(index: number): RGB {
    const p = this.p5Instance;

    const colorIndex = this.getColorIndex(index);

    if (this.hasCache(colorIndex)) return this.readCache(colorIndex);

    const color = this.p5Instance.color(this.f(colorIndex));
    const rgb = extractRGB(p, color);
    this.writeCache(colorIndex, rgb);
    return rgb;
  }

  r(index: number): number {
    const colorIndex = this.getColorIndex(index);
    if (this.hasCache(colorIndex)) return this.cache[colorIndex * 3 + 0];

    const [r] = this.rgb(index);
    return r;
  }

  g(index: number): number {
    const colorIndex = this.getColorIndex(index);
    if (this.hasCache(colorIndex)) return this.cache[colorIndex * 3 + 1];

    const [, g] = this.rgb(index);
    return g;
  }

  b(index: number): number {
    const colorIndex = this.getColorIndex(index);
    if (this.hasCache(colorIndex)) return this.cache[colorIndex * 3 + 2];

    const [, , b] = this.rgb(index);
    return b;
  }

  size(): number {
    return this.mirrored ? this.colorLength * 2 : this.colorLength;
  }
  getColorIndex(index: number): number {
    if (this.mirrored) {
      // 折り返す
      const length = this.colorLength * 2;
      const offsettedIndex = (index + this.offsetIndex) % length;

      return offsettedIndex < this.colorLength
        ? offsettedIndex
        : length - offsettedIndex - 1;
    } else {
      // そのまま
      return (index + this.offsetIndex) % this.colorLength;
    }
  }
  setOffset(offsetIndex: number): void {
    this.offsetIndex = offsetIndex;
  }
  setLength(length: number): void {
    this.colorLength = length;

    this.cache = new Uint8ClampedArray(this.colorLength * 3);
    this.cacheInitialized = new Array(this.colorLength).fill(false);
  }
  setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
  }
  hasCache(index: number): boolean {
    return this.cacheInitialized[index];
  }
  readCache(index: number): RGB {
    const idx = index * 3;
    return [this.cache[idx + 0], this.cache[idx + 1], this.cache[idx + 2]];
  }
  writeCache(index: number, rgb: RGB): void {
    const idx = index * 3;
    const [r, g, b] = rgb;
    this.cache[idx + 0] = r;
    this.cache[idx + 1] = g;
    this.cache[idx + 2] = b;
    this.cacheInitialized[index] = true;
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
