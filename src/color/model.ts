import { clamp } from "@/math";

export type RGB = [number, number, number];

export type Palette = {
  rgb(index: number): RGB;

  r(index: number): number;
  g(index: number): number;
  b(index: number): number;

  size(): number;

  setOffset(offsetIndex: number): void;
  cycleOffset(step?: number): void;
  setLength(length: number): void;
  setMirrored(mirrored: boolean): void;

  serialize(): string;
};

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

export const buildRGB32Byte = ({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): RGB => {
  return [r * 255, g * 255, b * 255];
};

export const clampedPaletteParams = (length: number, offset: number) => {
  return {
    colorLength: clamp(length, 1, 8192),
    offsetIndex: clamp(offset, 0, length * 2 - 1),
  };
};
