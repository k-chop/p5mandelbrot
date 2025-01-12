import { safeParseInt } from "@/math/util";
import { samples } from "culori";
import { color } from "d3-color";
import {
  interpolateInferno,
  interpolateRdYlBu,
  interpolateSinebow,
  interpolateTurbo,
} from "d3-scale-chromatic";
import { BasePalette } from "./color";
import { Palette, RGB, buildRGB, clampedPaletteParams } from "./model";

type D3Interpolator = (t: number) => string;
type D3Color = ReturnType<typeof color>;

const getInterpolatorFromName = (name: string): D3Interpolator => {
  switch (name) {
    case "Inferno":
      return interpolateInferno;
    case "RdYlBlu":
      return interpolateRdYlBu;
    case "Turbo":
      return interpolateTurbo;
    case "Sinebow":
      return interpolateSinebow;
    default:
      return interpolateRdYlBu;
  }
};

const getInterpolatorName = (interpolator: D3Interpolator): string => {
  if (interpolator === interpolateInferno) {
    return "Inferno";
  } else if (interpolator === interpolateRdYlBu) {
    return "RdYlBlu";
  } else if (interpolator === interpolateTurbo) {
    return "Turbo";
  } else if (interpolator === interpolateSinebow) {
    return "Sinebow";
  } else {
    return "RdYlBlu";
  }
};

export class D3ChromaticPalette extends BasePalette {
  interpolator: D3Interpolator;
  colors: D3Color[] = [];

  constructor(
    interpolator: D3Interpolator,
    length: number,
    mirrored = true,
    offset = 0,
  ) {
    const { colorLength, offsetIndex } = clampedPaletteParams(length, offset);

    super(colorLength, mirrored, offsetIndex);

    this.interpolator = interpolator;

    this.buildColors();
  }

  getRGBFromColorIndex(index: number): RGB {
    return buildRGB(this.colors[index]?.rgb() ?? [0, 0, 0]);
  }

  buildColors(): void {
    this.colors = samples(this.colorLength)
      .map((t) => color(this.interpolator(t)))
      .filter((v): v is NonNullable<typeof v> => v != null);
    this.fillCache();
  }

  serialize(): string {
    const result = ["d3-chromatic"];
    result.push(getInterpolatorName(this.interpolator));
    result.push(this.mirrored ? "1" : "0");
    result.push(`${this.colorLength}`);
    result.push(`${this.offsetIndex}`);

    return result.join(",");
  }

  static deserialize(serialized: string): D3ChromaticPalette {
    const [, rawInterpolate, rawMirrored, rawLength, rawOffset] =
      serialized.split(",");

    const length = safeParseInt(rawLength);
    const offset = safeParseInt(rawOffset);
    const mirrored = rawMirrored === "1";

    const interpolator = getInterpolatorFromName(rawInterpolate);

    return new D3ChromaticPalette(interpolator, length, mirrored, offset);
  }
}

export const d3ChromaticPalettes = [
  new D3ChromaticPalette(interpolateRdYlBu, 128),
  new D3ChromaticPalette(interpolateTurbo, 128),
  new D3ChromaticPalette(interpolateInferno, 128),
] satisfies Palette[];
