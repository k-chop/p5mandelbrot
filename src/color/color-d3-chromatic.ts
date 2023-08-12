import { Palette, RGB, buildRGB } from ".";
import { samples } from "culori";
import {
  interpolateInferno,
  interpolateRdYlBu,
  interpolateSinebow,
  interpolateTurbo,
} from "d3-scale-chromatic";
import { color } from "d3-color";

type D3Interpolator = (t: number) => string;

class D3ChromaticPalette implements Palette {
  private cache: Uint8ClampedArray;
  private cacheInitialized: boolean[];

  private offsetIndex = 0;
  private mirrored = true;
  private colorLength = 256;

  private interpolator: D3Interpolator;
  private colors: ReturnType<typeof color>[] = [];

  constructor(interpolator: D3Interpolator, length: number) {
    this.colorLength = length;
    this.interpolator = interpolator;

    this.cache = new Uint8ClampedArray(this.colorLength * 3);
    this.cacheInitialized = new Array(this.colorLength).fill(false);

    this.buildColors();
    console.log(this.colors);
  }

  private buildColors(): void {
    this.colors = samples(this.colorLength)
      .map((t) => color(this.interpolator(t)))
      .filter((v): v is NonNullable<typeof v> => v != null);
  }

  public rgb(index: number): RGB {
    const colorIndex = this.getColorIndex(index);

    if (this.hasCache(colorIndex)) return this.readCache(colorIndex);

    const d3rgb = this.colors[colorIndex].rgb();
    const rgb = buildRGB(d3rgb);
    this.writeCache(colorIndex, rgb);
    return rgb;
  }

  public r(index: number): number {
    const colorIndex = this.getColorIndex(index);
    if (this.hasCache(colorIndex)) return this.cache[colorIndex * 3 + 0];

    return this.rgb(colorIndex)[0];
  }

  public g(index: number): number {
    const colorIndex = this.getColorIndex(index);
    if (this.hasCache(colorIndex)) return this.cache[colorIndex * 3 + 1];

    return this.rgb(colorIndex)[1];
  }

  public b(index: number): number {
    const colorIndex = this.getColorIndex(index);
    if (this.hasCache(colorIndex)) return this.cache[colorIndex * 3 + 2];

    return this.rgb(colorIndex)[2];
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

    this.cache = new Uint8ClampedArray(this.colorLength * 3);
    this.cacheInitialized = new Array(this.colorLength).fill(false);

    this.buildColors();
  }

  public setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
  }
  private hasCache(index: number): boolean {
    return this.cacheInitialized[index];
  }
  private readCache(index: number): RGB {
    const idx = index * 3;
    return [this.cache[idx + 0], this.cache[idx + 1], this.cache[idx + 2]];
  }
  private writeCache(index: number, rgb: RGB): void {
    const idx = index * 3;
    const [r, g, b] = rgb;
    this.cache[idx + 0] = r;
    this.cache[idx + 1] = g;
    this.cache[idx + 2] = b;
    this.cacheInitialized[index] = true;
  }
}

export const d3ChromaticPalettes = [
  new D3ChromaticPalette(interpolateRdYlBu, 128),
  new D3ChromaticPalette(interpolateTurbo, 128),
  new D3ChromaticPalette(interpolateInferno, 128),
  new D3ChromaticPalette(interpolateSinebow, 128),
] satisfies Palette[];
