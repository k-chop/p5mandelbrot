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
  private cacheInitialized: boolean[] = [];

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

    if (this.mirrored) {
      // 折り返す
      const length = this.colorLength * 2;
      const offsettedIndex = (index + this.offsetIndex) % length;

      const idx =
        offsettedIndex < this.colorLength
          ? offsettedIndex
          : length - offsettedIndex - 1;

      if (this.hasCache(idx)) return this.readCache(idx);

      const color = this.p5Instance.color(this.f(idx));
      const rgb = extractRGB(p, color);
      this.writeCache(idx, rgb);
      return rgb;
    } else {
      // そのまま
      const offsettedIndex = (index + this.offsetIndex) % this.colorLength;

      if (this.hasCache(offsettedIndex)) return this.readCache(offsettedIndex);

      const color = this.p5Instance.color(this.f(offsettedIndex));
      const rgb = extractRGB(p, color);
      this.writeCache(offsettedIndex, rgb);
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
