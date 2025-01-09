import type { Palette } from "@/color";

// 描画時に使うpaletteに関するファイル

let lastColorIdx = 0;
let currentColorIdx = 0;
let palettes: Palette[] = [];

export const colorChanged = () => {
  return lastColorIdx !== currentColorIdx;
};

export const updateColor = () => {
  lastColorIdx = currentColorIdx;
};

export const redraw = () => {
  lastColorIdx = -1;
};

export const addPalettes = (...plts: Palette[]) => {
  palettes.push(...plts);
};

export const setColorIndex = (index: number) => {
  if (palettes[index]) {
    currentColorIdx = index;
  } else {
    currentColorIdx = 0;
  }
};

export const getPalette = () => palettes[currentColorIdx];
