export type RGB = [number, number, number];

export const buildRGB = ({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): RGB => {
  return [r, g, b];
};

export type Palette = {
  rgb(index: number): RGB;

  r(index: number): number;
  g(index: number): number;
  b(index: number): number;

  size(): number;

  setOffset(offsetIndex: number): void;
  setLength(length: number): void;
  setMirrored(mirrored: boolean): void;
};
