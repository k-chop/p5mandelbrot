import type { Palette, RGB } from "./model";

export class BasePalette implements Palette {
  cache!: Uint8ClampedArray;
  cacheInitialized!: boolean[];

  offsetIndex = 0;
  mirrored = true;
  colorLength;

  constructor(length: number, mirrored = true, offsetIndex = 0) {
    this.colorLength = length;
    this.mirrored = mirrored;
    this.offsetIndex = offsetIndex;

    this.resetCache();
  }

  resetCache(): void {
    this.cache = new Uint8ClampedArray(this.colorLength * 3);
    this.cacheInitialized = new Array(this.colorLength).fill(false);
  }

  fillCache(): void {
    console.log("Fill cache: ", this.colorLength);

    for (let i = 0; i < this.colorLength; i++) {
      const rgb = this.getRGBFromColorIndex(i);
      this.writeCache(i, rgb);
    }
  }

  getRGBFromColorIndex(index: number): RGB {
    throw new Error("Not implemented");
  }

  buildColors(): void {
    throw new Error("Not implemented");
  }

  serialize(): string {
    throw new Error("Not implemented");
  }

  public rgb(index: number): RGB {
    const colorIndex = this.getColorIndex(index);

    if (this.hasCache(colorIndex)) return this.readCache(colorIndex);

    const rgb = this.getRGBFromColorIndex(colorIndex);
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

  public cycleOffset(step = 1): void {
    this.offsetIndex = (this.offsetIndex + step) % (this.colorLength * 2);
  }

  public setLength(length: number): void {
    this.colorLength = length;

    this.resetCache();
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
