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
    const colorIndex = this.getColorIndex(index);
    return this.colors[colorIndex].rgb();
  }

  public r(index: number): number {
    const colorIndex = this.getColorIndex(index);
    return this.colors[colorIndex].rgb()[0];
  }

  public g(index: number): number {
    const colorIndex = this.getColorIndex(index);
    return this.colors[colorIndex].rgb()[1];
  }

  public b(index: number): number {
    const colorIndex = this.getColorIndex(index);
    return this.colors[colorIndex].rgb()[2];
  }

  public size(): number {
    return this.mirrored ? this.colorLength * 2 : this.colorLength;
  }
  getColorIndex(index: number) {
    if (this.mirrored) {
      // 折り返す
      const length = this.colorLength * 2;
      const offsettedIndex = (index + this.offsetIndex) % length;

      if (offsettedIndex < this.colorLength) {
        return offsettedIndex;
      } else {
        return length - offsettedIndex - 1;
      }
    } else {
      // そのまま
      const offsettedIndex = (index + this.offsetIndex) % this.colorLength;
      return offsettedIndex;
    }
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
