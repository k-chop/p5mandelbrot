import { calcCoordPrecision } from "@/math/coord-precision";
import type { MandelbrotWorkerType, POIData } from "@/types";
import { isDevMode } from "@/utils/dev-mode";
import BigNumber from "bignumber.js";
import { useSyncExternalStore } from "react";

/** GCSプロキシのベースURL（Cloudflare Worker経由） */
const GCS_BASE_URL =
  "https://p5mandelbrot-gcs-proxy.7bb81493-fc28-4b3b-918a-7098cdfffb9a.workers.dev";

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
let presetPOIList: readonly PresetPOIRaw[] = [];

/** useSyncExternalStore用の購読管理 */
const listeners = new Set<() => void>();

/**
 * プリセットPOIリストの変更を購読する
 */
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * 購読者に変更を通知する
 */
const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

/**
 * プリセットPOIリストをReactコンポーネントから購読するhook
 */
export const usePresetPOIList = (): readonly PresetPOIRaw[] => {
  return useSyncExternalStore(subscribe, getPresetPOIList);
};

/** シャッフル済みのインデックス配列 */
let shuffledIndices: number[] = [];
let cursor = 0;

/** GCSから取得するモードか（開発時のみ切り替え可能、本番では常にtrue） */
let useGCS = !isDevMode();

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
 * GCSモードかどうかを返す
 */
export const isGCSMode = (): boolean => useGCS;

/**
 * GCSモードを切り替える（開発時のみ使用）
 */
export const setGCSMode = (value: boolean): void => {
  useGCS = value;
};

/**
 * プリセットPOIのサムネイルURLを返す
 */
export const getPresetThumbnailUrl = (id: string, revision?: number): string => {
  if (useGCS) {
    return `${GCS_BASE_URL}/thumbnails/${id}.png`;
  }
  if (isDevMode()) {
    return `http://localhost:8080/api/preset-poi/${id}/thumbnail${revision != null ? `?v=${revision}` : ""}`;
  }
  return `${import.meta.env.BASE_URL ?? "/"}preset-poi/thumbnails/${id}.png`;
};

/**
 * parameters.json からプリセットPOIリストを読み込んで初期化する
 *
 * アプリ起動時に1回呼び出す。読み込み完了後にシャッフルインデックスを構築する。
 */
export const initializePresetPOIList = async (): Promise<void> => {
  const url = useGCS
    ? `${GCS_BASE_URL}/parameters.json`
    : `${import.meta.env.BASE_URL ?? "/"}preset-poi/parameters.json`;
  const res = await fetch(url);
  presetPOIList = await res.json();
  shuffledIndices = shuffle([...Array(presetPOIList.length).keys()]);
  cursor = 0;
  emitChange();
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
/**
 * POIDataがプリセットリストに既登録かを判定する
 *
 * precision切り捨て後のx, y, r, Nで比較する。
 */
export const isRegisteredAsPreset = (poi: POIData): boolean => {
  const precision = calcCoordPrecision(poi.r);
  const px = poi.x.toPrecision(precision);
  const py = poi.y.toPrecision(precision);
  const pr = poi.r.toString();

  return presetPOIList.some((preset) => {
    const presetX = new BigNumber(preset.x).toPrecision(precision);
    const presetY = new BigNumber(preset.y).toPrecision(precision);
    return presetX === px && presetY === py && preset.r === pr && preset.N === poi.N;
  });
};

export const getRandomPresetPOI = (): PresetPOIRaw => {
  if (presetPOIList.length === 0) {
    throw new Error("Preset POI list is not initialized. Call initializePresetPOIList() first.");
  }
  const index = shuffledIndices[cursor];
  cursor = (cursor + 1) % shuffledIndices.length;
  return presetPOIList[index];
};
