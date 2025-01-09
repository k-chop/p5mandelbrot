import {
  chromaJsPalettes,
  d3ChromaticPalettes,
  othersPalettes,
  type Palette,
} from "@/color";

// 描画時に使うpaletteに関するファイル

let lastColorIdx = 0;
let currentColorIdx = 0;
const palettePresets: Palette[] = [
  ...d3ChromaticPalettes,
  ...othersPalettes,
  ...chromaJsPalettes,
];

export const colorChanged = () => {
  return lastColorIdx !== currentColorIdx;
};

export const updateColor = () => {
  lastColorIdx = currentColorIdx;
};

export const redraw = () => {
  lastColorIdx = -1;
};

export const setColorIndex = (index: number) => {
  if (palettePresets[index]) {
    currentColorIdx = index;
  } else {
    currentColorIdx = 0;
  }
};

/**
 * 現在描画に使用しているPaletteを返す
 */
export const getCurrentPalette = () => palettePresets[currentColorIdx];

/**
 * 現在描画に使用しているPaletteのオフセットを設定する
 */
export const setCurrentPaletteOffset = (offset: number) => {
  getCurrentPalette().setOffset(offset);
};

/**
 * 現在描画に使用しているPaletteの長さを設定する
 */
export const setCurrentPaletteLength = (length: number) => {
  getCurrentPalette().setLength(length);
};

/**
 * 現在描画に使用しているPaletteのoffsetを進める
 */
export const cycleCurrentPaletteOffset = (step = 1) => {
  getCurrentPalette().cycleOffset(step);
};
