import chroma from "chroma-js";
import { BasePalette, Palette, RGB } from ".";

export class ChromaJsPalette extends BasePalette {
  colorConstructor: string[];
  colors: chroma.Color[] = [];

  constructor(colorConstructor: string[], length: number) {
    const colorLength = Math.max(1, length);

    super(colorLength);
    this.colorLength = colorLength;

    if (colorConstructor.length === 0) {
      this.colorConstructor = ["black"];
    } else {
      this.colorConstructor = colorConstructor;
    }

    this.buildColors();
  }

  getRGBFromColorIndex(index: number): RGB {
    return this.colors[index]?.rgb() ?? [0, 0, 0];
  }

  buildColors(): void {
    this.colors = chroma
      .scale(this.colorConstructor)
      .colors(this.colorLength, null);
  }

  serialize(): string {
    const result = ["chroma-js"];
    result.push(`${this.colorConstructor.length}`);
    result.push(...this.colorConstructor);
    result.push(`${this.mirrored ? 1 : 0}`);
    result.push(`${this.colorLength}`);
    result.push(`${this.offsetIndex}`);

    return result.join(",");
  }
}

export const chromaJsPalettes = [
  // new ChromaJsPalette(["black", "red", "yellow", "white"], 128), // prominence
  new ChromaJsPalette(["lightblue", "navy", "white"], 128), // icy
  new ChromaJsPalette(["lightgreen", "green", "#d3b480", "green"], 128), // forest
] satisfies Palette[];
