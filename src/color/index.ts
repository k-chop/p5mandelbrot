export type ColorType = Uint8ClampedArray;
export type ColorBuilder<T = any> = (...args: T[]) => ColorType[];
export type RGB = [number, number, number];

export type Palette = {
  rgb(index: number): RGB;
  size(): number;

  setOffset(offsetIndex: number): void;
  setLength(length: number): void;
  setMirrored(mirrored: boolean): void;
};
