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

/**
 * 再renderが必要かどうかを返す
 */
export const needsRerender = () => {
  return lastColorIdx !== currentColorIdx;
};

/**
 * 現状のPaletteの状態でrender済みとしてマークする
 *
 * canvasの状態が変わらない時に次回以降のrenderをスキップするために使う
 */
export const markAsRendered = () => {
  lastColorIdx = currentColorIdx;
};

/**
 * 次に再renderするようマークする
 */
export const markNeedsRerender = () => {
  lastColorIdx = -1;
};

/**
 * presetに登録してあるPaletteを選択する
 */
export const changePaletteFromPresets = (index: number) => {
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
