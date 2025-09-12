import {
  chromaJsPalettes,
  d3ChromaticPalettes,
  deserializePalette,
  othersPalettes,
  type Palette,
} from "@/color";
import { updatePaletteData } from "@/rendering/renderer";
import { getStore, updateStore } from "@/store/store";

// 描画時に使うpaletteの状態に関するファイル

/** paletteのプリセット */
const palettePresets: Record<string, Palette> = {
  ...d3ChromaticPalettes,
  ...othersPalettes,
  ...chromaJsPalettes,
};

/** 現在選択中のPalette */
let currentPalette: Palette = palettePresets.RdYlBu;
/** trueなら次回renderが必要 */
let renderNext = true;

/**
 * 次に再renderするようマークする
 */
export const markNeedsRerender = () => {
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
  let newPalette = currentPalette;

  const selected = Object.values(palettePresets)[index];
  if (selected) {
    newPalette = selected;
  }

  setPalette(newPalette);
};

/** 書き換え防止のためhallo copyして返す */
export const getPalettePreset = () => {
  return { ...palettePresets };
};

/**
 * Paletteを指定して変更する
 */
export const setPalette = (
  palette: Palette = currentPalette,
  options: { keepLength?: boolean } = {},
) => {
  const { keepLength = false } = options;

  const prevLength = getStore("paletteLength");
  const prevOffset = getStore("paletteOffset");

  currentPalette = palette;
  markNeedsRerender();

  if (keepLength) {
    palette.setLength(prevLength);
    palette.setOffset(prevOffset);
  }
  updatePaletteData(palette);

  updateStore("paletteLength", keepLength ? prevLength : palette.length);
  updateStore("paletteOffset", keepLength ? prevOffset : palette.offset);
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

  setPalette(palette);
};

/**
 * 現在描画に使用しているPaletteのオフセットを設定する
 */
export const setCurrentPaletteOffset = (offset: number) => {
  const palette = getCurrentPalette();
  palette.setOffset(offset);
  markNeedsRerender();

  // offset変更時はupdatePaletteDataする必要ない

  updateStore("paletteOffset", palette.offset);
};

/**
 * 現在描画に使用しているPaletteの長さを設定する
 */
export const setCurrentPaletteLength = (length: number) => {
  const palette = getCurrentPalette();
  palette.setLength(length);
  markNeedsRerender();

  updatePaletteData(palette);

  updateStore("paletteLength", palette.length);
};

/**
 * 現在描画に使用しているPaletteのoffsetを進める
 */
export const cycleCurrentPaletteOffset = (step = 1) => {
  getCurrentPalette().cycleOffset(step);
  markNeedsRerender();
};
