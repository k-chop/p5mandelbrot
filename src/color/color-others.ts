import p5 from "p5";
import { BasePalette, Palette, RGB, clampedPaletteParams } from ".";

const posterize = (
  p: p5,
  value: number,
  numberOfTones: number,
  lower: number,
  upper: number,
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

export class OthersPalette extends BasePalette {
  private p5Instance: p5;
  private f: (index: number, colorLength: number) => p5.Color;

  constructor(
    p: p5,
    length: number,
    f: (index: number, colorLength: number) => p5.Color,
    mirrored = true,
    offset = 0,
  ) {
    const { colorLength, offsetIndex } = clampedPaletteParams(length, offset);

    super(colorLength, mirrored, offsetIndex);

    this.p5Instance = p;
    this.f = f;

    this.buildColors();
  }

  buildColors(): void {
    // do nothing
  }

  getRGBFromColorIndex(index: number): RGB {
    const color = this.p5Instance.color(this.f(index, this.colorLength));
    return extractRGB(this.p5Instance, color);
  }
}

export const othersPalettes = (p: p5) =>
  [
    new OthersPalette(p, 128, (idx, length) => {
      // hue 0~360
      const hue = posterize(p, idx, length, 0, 360);
      return p.color(hue, 75, 100);
    }),
    new OthersPalette(p, 128, (idx, length) => {
      // monochrome
      const brightness = posterize(p, idx, length, 20, 100);
      return p.color(0, 0, brightness);
    }),

    new OthersPalette(p, 128, (idx, length) => {
      // fire
      const brightness = posterize(p, idx, length, 30, 100);
      const hue = posterize(p, idx, length, -30, 60);
      return p.color(hue, 90, brightness);
    }),
  ] satisfies Palette[];
