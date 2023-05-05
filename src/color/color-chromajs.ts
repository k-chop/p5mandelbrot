import chroma from "chroma-js";
import { Palette, RGB } from ".";

class ChromaJsPalette implements Palette {
  private offsetIndex = 0;
  private mirrored = true;
  private colorLength = 256;

  private colorConstructor: (string | chroma.Color)[];

  private colors: chroma.Color[] = [];

  constructor(
    colorConstructor: (string | chroma.Color)[],
    length: number = 256
  ) {
    this.colorLength = length;
    this.colorConstructor = colorConstructor;

    this.buildColors();
  }

  private buildColors(): void {
    this.colors = chroma
      .scale(this.colorConstructor)
      .colors(this.colorLength, null);
  }

  public rgb(index: number): RGB {
    if (this.mirrored) {
      // 折り返す
      const length = this.colorLength * 2;
      const offsettedIndex = (index + this.offsetIndex) % length;

      if (offsettedIndex < this.colorLength) {
        return this.colors[offsettedIndex].rgb();
      } else {
        return this.colors[length - offsettedIndex - 1].rgb();
      }
    } else {
      // そのまま
      const offsettedIndex = (index + this.offsetIndex) % this.colorLength;
      return this.colors[offsettedIndex].rgb();
    }
  }

  public size(): number {
    return this.mirrored ? this.colorLength * 2 : this.colorLength;
  }

  public setOffset(offsetIndex: number): void {
    this.offsetIndex = offsetIndex;
  }

  public setLength(length: number): void {
    this.colorLength = length;
    this.buildColors();
  }

  public setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
  }
}

export const chromaJsPalettes = [
  new ChromaJsPalette(["black", "red", "yellow", "white"]),
];
