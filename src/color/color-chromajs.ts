import chroma from "chroma-js";
import { BasePalette, Palette, RGB } from ".";

class ChromaJsPalette extends BasePalette<chroma.Color> {
  colorConstructor: (string | chroma.Color)[];

  constructor(colorConstructor: (string | chroma.Color)[], length: number) {
    super(length);

    this.colorConstructor = colorConstructor;

    this.buildColors();
  }

  colorToRGB(color: chroma.Color): RGB {
    return color.rgb();
  }

  buildColors(): void {
    this.colors = chroma
      .scale(this.colorConstructor)
      .colors(this.colorLength, null);
  }
}

export const chromaJsPalettes = [
  // new ChromaJsPalette(["black", "red", "yellow", "white"], 128), // prominence
  new ChromaJsPalette(["lightblue", "navy", "white"], 128), // icy
  new ChromaJsPalette(["lightgreen", "green", "#d3b480", "green"], 128), // forest
] satisfies Palette[];
