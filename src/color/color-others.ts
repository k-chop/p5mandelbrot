import { safeParseInt } from "@/math";
import { Hsv, convertHsvToRgb, samples } from "culori";
import { BasePalette } from "./color";
import { Palette, RGB, buildRGB32Byte, clampedPaletteParams } from "./model";

type OthersInterpolator = (t: number) => Hsv;

const interpolators: Record<string, OthersInterpolator> = {
  hue360: (t) => {
    // hue 0~360
    const hue = Math.floor(t * 360);
    return { mode: "hsv", h: hue, s: 0.75, v: 1 };
  },
  monochrome: (t) => {
    // monochrome
    const brightness = t * 0.8 + 0.2;
    return { mode: "hsv", s: 0, v: brightness };
  },
  fire: (t) => {
    // fire
    const brightness = t * 0.7 + 0.3;
    const hue = Math.floor(t * 90) - 30;
    return { mode: "hsv", h: hue, s: 0.9, v: brightness };
  },
};

const getInterpolatorFromName = (name: string): ((t: number) => Hsv) => {
  const interpolator = interpolators[name];
  return interpolator ?? interpolators.hue360;
};

const getInterpolatorName = (interpolator: OthersInterpolator): string => {
  for (const [name, func] of Object.entries(interpolators)) {
    if (func === interpolator) {
      return name;
    }
  }
  return "hue360";
};

export class OthersPalette extends BasePalette {
  private interpolator: (t: number) => Hsv;
  colors: Hsv[] = [];

  constructor(
    length: number,
    interpolator: (t: number) => Hsv,
    mirrored = true,
    offset = 0,
  ) {
    const { colorLength, offsetIndex } = clampedPaletteParams(length, offset);

    super(colorLength, mirrored, offsetIndex);

    this.interpolator = interpolator;

    this.buildColors();
  }

  buildColors(): void {
    this.colors = samples(this.colorLength)
      .map((t) => this.interpolator(t))
      .filter((v): v is NonNullable<typeof v> => v != null);
    this.fillCache();
  }

  getRGBFromColorIndex(index: number): RGB {
    return buildRGB32Byte(convertHsvToRgb(this.colors[index]));
  }

  serialize(): string {
    const result = ["others"];
    result.push(getInterpolatorName(this.interpolator));
    result.push(`${this.mirrored ? 1 : 0}`);
    result.push(`${this.colorLength}`);
    result.push(`${this.offsetIndex}`);

    return result.join(",");
  }

  static deserialize(serialized: string): OthersPalette {
    const [, rawInterpolate, rawMirrored, rawLength, rawOffset] =
      serialized.split(",");

    const length = safeParseInt(rawLength);
    const offset = safeParseInt(rawOffset);
    const mirrored = rawMirrored === "1";

    const interpolator = getInterpolatorFromName(rawInterpolate);

    return new OthersPalette(length, interpolator, mirrored, offset);
  }
}

export const othersPalettes = [
  new OthersPalette(128, interpolators.hue360),
  new OthersPalette(128, interpolators.monochrome),
  new OthersPalette(128, interpolators.fire),
] satisfies Palette[];
