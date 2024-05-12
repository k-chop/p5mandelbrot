import { Hsv, convertHsvToRgb, samples } from "culori";
import p5 from "p5";
import {
  BasePalette,
  Palette,
  RGB,
  buildRGB32Byte,
  clampedPaletteParams,
} from ".";

export class OthersPalette extends BasePalette {
  private f: (t: number) => Hsv;
  colors: Hsv[] = [];

  constructor(
    length: number,
    f: (t: number) => Hsv,
    mirrored = true,
    offset = 0,
  ) {
    const { colorLength, offsetIndex } = clampedPaletteParams(length, offset);

    super(colorLength, mirrored, offsetIndex);

    this.f = f;

    this.buildColors();
  }

  buildColors(): void {
    this.colors = samples(this.colorLength)
      .map((t) => this.f(t))
      .filter((v): v is NonNullable<typeof v> => v != null);
  }

  getRGBFromColorIndex(index: number): RGB {
    return buildRGB32Byte(convertHsvToRgb(this.colors[index]));
  }
}

export const othersPalettes = (p: p5) =>
  [
    new OthersPalette(128, (t) => {
      // hue 0~360
      const hue = Math.floor(t * 360);
      return { mode: "hsv", h: hue, s: 0.75, v: 1 };
    }),
    new OthersPalette(128, (t) => {
      // monochrome
      const brightness = t * 0.8 + 0.2;
      return { mode: "hsv", s: 0, v: brightness };
    }),
    new OthersPalette(128, (t) => {
      // fire
      const brightness = t * 0.7 + 0.3;
      const hue = Math.floor(t * 90) - 30;
      return { mode: "hsv", h: hue, s: 0.9, v: brightness };
    }),
  ] satisfies Palette[];
