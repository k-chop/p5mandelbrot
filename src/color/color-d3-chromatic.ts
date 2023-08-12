import { BasePalette, Palette, RGB, buildRGB } from ".";
import { samples } from "culori";
import {
  interpolateInferno,
  interpolateRdYlBu,
  interpolateSinebow,
  interpolateTurbo,
} from "d3-scale-chromatic";
import { color } from "d3-color";

type D3Interpolator = (t: number) => string;
type D3Color = ReturnType<typeof color>;

class D3ChromaticPalette extends BasePalette<D3Color> {
  interpolator: D3Interpolator;

  constructor(interpolator: D3Interpolator, length: number) {
    super(length);

    this.interpolator = interpolator;

    this.buildColors();
  }

  colorToRGB(color: D3Color): RGB {
    return buildRGB(color.rgb());
  }

  buildColors(): void {
    this.colors = samples(this.colorLength)
      .map((t) => color(this.interpolator(t)))
      .filter((v): v is NonNullable<typeof v> => v != null);
  }
}

export const d3ChromaticPalettes = [
  new D3ChromaticPalette(interpolateRdYlBu, 128),
  new D3ChromaticPalette(interpolateTurbo, 128),
  new D3ChromaticPalette(interpolateInferno, 128),
  new D3ChromaticPalette(interpolateSinebow, 128),
] satisfies Palette[];
