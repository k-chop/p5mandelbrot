import {
  chromaJsPalettes,
  d3ChromaticPalettes,
  deserializePalette,
  othersPalettes,
  type Palette,
} from "@/color";

// 描画時に使うpaletteの状態に関するファイル

/** 数値キーで選択できるpaletteのプリセット */
const palettePresets: Palette[] = [
  ...d3ChromaticPalettes,
  ...othersPalettes,
  ...chromaJsPalettes,
];

/** 現在選択中のPalette */
let currentPalette: Palette = palettePresets[0];
/** trueなら次回renderが必要 */
let renderNext = true;

/**
 * 次に再renderするようマークする
 */
const markNeedsRerender = () => {
  renderNext = true;
};

/**
 * 再renderが必要かどうかを返す
 */
export const needsRerender = () => {
  return renderNext;
};

/**
 * 現状のPaletteの状態でrender済みとしてマークする
 *
 * canvasの状態が変わらない時に次回以降のrenderをスキップするために使う
 */
export const markAsRendered = () => {
  renderNext = false;
};

/**
 * 現在描画に使用しているPaletteを返す
 */
export const getCurrentPalette = () => currentPalette;

/**
 * presetに登録してあるPaletteを選択する
 */
export const changePaletteFromPresets = (index: number) => {
  if (palettePresets[index]) {
    currentPalette = palettePresets[index];
  } else {
    currentPalette = palettePresets[0];
  }
  markNeedsRerender();
};

/**
 * Paletteを指定して変更する
 */
export const setPalette = (palette: Palette) => {
  currentPalette = palette;
  markNeedsRerender();
};

/**
 * serializedされたPaletteを設定する
 *
 * deserializeに失敗した場合は握りつぶして現在のpaletteを維持する
 */
export const setSerializedPalette = (serialized?: string) => {
  if (serialized == null) return;

  let palette = getCurrentPalette();

  try {
    palette = deserializePalette(serialized);
  } catch (e) {
    console.error(e);
  }

  console.log("Loaded serialized palette", palette);
  console.log(
    "But this feature is currently bugged and not working. We'll keep the current palette for now, sorry.",
  );

  // setPalette(palette);
};

/**
 * 現在描画に使用しているPaletteのオフセットを設定する
 */
export const setCurrentPaletteOffset = (offset: number) => {
  getCurrentPalette().setOffset(offset);
  markNeedsRerender();
};

/**
 * 現在描画に使用しているPaletteの長さを設定する
 */
export const setCurrentPaletteLength = (length: number) => {
  getCurrentPalette().setLength(length);
  markNeedsRerender();
};

/**
 * 現在描画に使用しているPaletteのoffsetを進める
 */
export const cycleCurrentPaletteOffset = (step = 1) => {
  getCurrentPalette().cycleOffset(step);
  markNeedsRerender();
};
