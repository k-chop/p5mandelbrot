import { safeParseInt } from "@/math/util";
import { samples } from "culori";
import { color } from "d3-color";
import {
  interpolateBrBG,
  interpolateInferno,
  interpolatePuOr,
  interpolateRdYlBu,
  interpolateSinebow,
  interpolateTurbo,
  interpolateYlGnBu,
} from "d3-scale-chromatic";
import { BasePalette } from "./color";
import type { Palette, RGB } from "./model";
import { buildRGB, clampedPaletteParams } from "./model";

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
    case "BrBG":
      return interpolateBrBG;
    case "YlGnBu":
      return interpolateYlGnBu;
    case "PuOr":
      return interpolatePuOr;
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
  } else if (interpolator === interpolateBrBG) {
    return "BrBG";
  } else if (interpolator === interpolateYlGnBu) {
    return "YlGnBu";
  } else if (interpolator === interpolatePuOr) {
    return "PuOr";
  } else {
    return "RdYlBlu";
  }
};

export class D3ChromaticPalette extends BasePalette {
  interpolator: D3Interpolator;
  colors: D3Color[] = [];

  constructor(interpolator: D3Interpolator, length: number, mirrored = true, offset = 0) {
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

  public get id(): string {
    const result = ["d3-chromatic"];
    result.push(getInterpolatorName(this.interpolator));
    result.push(this.mirrored ? "1" : "0");

    return result.join(",");
  }

  serialize(): string {
    const result = [];
    result.push(`${this.colorLength}`);
    result.push(`${this.offsetIndex}`);

    return `${this.id},${result.join(",")}`;
  }

  static deserialize(serialized: string): D3ChromaticPalette {
    const [, rawInterpolate, rawMirrored, rawLength, rawOffset] = serialized.split(",");

    const length = safeParseInt(rawLength);
    const offset = safeParseInt(rawOffset);
    const mirrored = rawMirrored === "1";

    const interpolator = getInterpolatorFromName(rawInterpolate);

    return new D3ChromaticPalette(interpolator, length, mirrored, offset);
  }
}

export const d3ChromaticPalettes = {
  RdYlBu: new D3ChromaticPalette(interpolateRdYlBu, 128),
  Turbo: new D3ChromaticPalette(interpolateTurbo, 128),
  Inferno: new D3ChromaticPalette(interpolateInferno, 128),
  SineBow: new D3ChromaticPalette(interpolateSinebow, 128),
  BrBG: new D3ChromaticPalette(interpolateBrBG, 128),
  YlGnBu: new D3ChromaticPalette(interpolateYlGnBu, 128),
  PuOr: new D3ChromaticPalette(interpolatePuOr, 128),
} satisfies Record<string, Palette>;
