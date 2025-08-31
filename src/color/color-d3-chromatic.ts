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
    displayName: string,
    id: string,
    length: number,
    mirrored = true,
    offset = 0,
  ) {
    const { colorLength, offsetIndex } = clampedPaletteParams(length, offset);

    super(colorLength, displayName, id, mirrored, offsetIndex);

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

    // FIXME: serialize -> deserializeで名前が失われる
    return result.join(",");
  }

  static deserialize(serialized: string): D3ChromaticPalette {
    const [, rawInterpolate, rawMirrored, rawLength, rawOffset] = serialized.split(",");

    const length = safeParseInt(rawLength);
    const offset = safeParseInt(rawOffset);
    const mirrored = rawMirrored === "1";

    const interpolator = getInterpolatorFromName(rawInterpolate);
    // FIXME: serialize -> deserializeで名前が失われる
    const displayName = getInterpolatorName(interpolator);
    const id = `d3-${getInterpolatorName(interpolator).toLowerCase()}`;

    return new D3ChromaticPalette(interpolator, displayName, id, length, mirrored, offset);
  }
}

export const d3ChromaticPalettes = [
  new D3ChromaticPalette(interpolateRdYlBu, "RdYlBu", "d3-rdylbu", 128),
  new D3ChromaticPalette(interpolateTurbo, "Turbo", "d3-turbo", 128),
  new D3ChromaticPalette(interpolateInferno, "Inferno", "d3-inferno", 128),
] satisfies Palette[];
