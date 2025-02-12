import { safeParseInt } from "@/math/util";
import chroma from "chroma-js";
import { BasePalette } from "./color";
import { Palette, RGB, clampedPaletteParams } from "./model";

export class ChromaJsPalette extends BasePalette {
  colorConstructor: string[];
  colors: chroma.Color[] = [];

  constructor(
    colorConstructor: string[],
    length: number,
    mirrored = true,
    offset = 0,
  ) {
    const { colorLength, offsetIndex } = clampedPaletteParams(length, offset);

    super(colorLength, mirrored, offsetIndex);

    if (colorConstructor.length === 0) {
      this.colorConstructor = ["black", "white"];
    } else if (colorConstructor.length > 16) {
      this.colorConstructor = colorConstructor.slice(0, 16);
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
    this.fillCache();
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

  static deserialize(serialized: string): ChromaJsPalette {
    const parts = serialized.split(",");
    const colorNum = safeParseInt(parts[1], 0);

    const colorConstructor = parts.slice(2, colorNum + 2);
    const mirrored = parts[2 + colorNum] === "1";
    const colorLength = safeParseInt(parts[2 + colorNum + 1], 16);
    const offset = safeParseInt(parts[2 + colorNum + 2], 0);

    return new ChromaJsPalette(colorConstructor, colorLength, mirrored, offset);
  }

  static defaultPalette(): ChromaJsPalette {
    return new ChromaJsPalette(["lightblue", "navy", "white"], 128);
  }
}

export const chromaJsPalettes = [
  // new ChromaJsPalette(["black", "red", "yellow", "white"], 128), // prominence
  new ChromaJsPalette(["lightblue", "navy", "white"], 128), // icy
  new ChromaJsPalette(["lightgreen", "green", "#d3b480", "green"], 128), // forest
] satisfies Palette[];
