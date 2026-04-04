import type { MandelbrotWorkerType } from "@/types";

/**
 * プリセットPOIの生データ型
 * BigNumberに変換する前の文字列表現
 */
export interface PresetPOIRaw {
  id: string;
  x: string;
  y: string;
  r: string;
  N: number;
  mode: MandelbrotWorkerType;
  palette?: string;
}

/** 読み込み済みのプリセットPOIリスト */
let presetPOIList: PresetPOIRaw[] = [];

/** シャッフル済みのインデックス配列 */
let shuffledIndices: number[] = [];
let cursor = 0;

/**
 * Fisher-Yatesシャッフルで配列をin-placeにシャッフルする
 */
const shuffle = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * parameters.json からプリセットPOIリストを読み込んで初期化する
 *
 * アプリ起動時に1回呼び出す。読み込み完了後にシャッフルインデックスを構築する。
 */
export const initializePresetPOIList = async (): Promise<void> => {
  const base = import.meta.env.BASE_URL ?? "/";
  const res = await fetch(`${base}preset-poi/parameters.json`);
  presetPOIList = await res.json();
  shuffledIndices = shuffle([...Array(presetPOIList.length).keys()]);
  cursor = 0;
};

/**
 * プリセットPOIリストを取得する
 */
export const getPresetPOIList = (): readonly PresetPOIRaw[] => presetPOIList;

/**
 * プリセットPOIリストからシャッフル順に1件取得する
 *
 * 全件を一巡するまで同じPOIは返さない。一巡したら先頭に戻る。
 */
export const getRandomPresetPOI = (): PresetPOIRaw => {
  if (presetPOIList.length === 0) {
    throw new Error("Preset POI list is not initialized. Call initializePresetPOIList() first.");
  }
  const index = shuffledIndices[cursor];
  cursor = (cursor + 1) % shuffledIndices.length;
  return presetPOIList[index];
};
