import type { Palette } from "@/color";
import BigNumber from "bignumber.js";
import type { MandelbrotParams, POIData } from "../../types";

export const createNewPOIData = (params: MandelbrotParams, palette: Palette): POIData => ({
  id: crypto.randomUUID(),
  ...params,
  serializedPalette: palette.serialize(),
});

export const writePOIListToStorage = (poiList: POIData[]) => {
  const serialized = JSON.stringify(poiList.map(serializePOIData));
  localStorage.setItem("poiList", serialized);
};

export const readPOIListFromStorage = (): POIData[] => {
  const serialized = localStorage.getItem("poiList");
  if (!serialized) return [];

  const rawList = JSON.parse(serialized);
  return rawList.map(deserializeMandelbrotParams);
};

export const serializePOIData = (params: POIData) => {
  return {
    id: params.id,
    x: params.x.toString(),
    y: params.y.toString(),
    r: params.r.toString(),
    N: params.N,
    mode: params.mode,
    serializedPalette: params.serializedPalette,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const deserializeMandelbrotParams = (params: any): POIData => {
  const id = params.id == null ? crypto.randomUUID() : params.id;

  return {
    id,
    x: new BigNumber(params.x),
    y: new BigNumber(params.y),
    r: new BigNumber(params.r),
    N: params.N,
    mode: params.mode,
    serializedPalette: params.serializedPalette,
  };
};

const SEPARATOR = "----";

/**
 * POIデータ1件をplain textにシリアライズする
 */
const serializePOIToText = (poi: POIData): string => {
  const lines = [
    `x: ${poi.x.toString()}`,
    `y: ${poi.y.toString()}`,
    `r: ${poi.r.toString()}`,
    `N: ${poi.N}`,
    `mode: ${poi.mode}`,
  ];
  if (poi.serializedPalette) {
    lines.push(`palette: ${poi.serializedPalette}`);
  }
  return lines.join("\n");
};

/**
 * POIリスト全体をplain textにシリアライズする
 */
export const serializePOIListToText = (poiList: POIData[]): string => {
  return poiList.map(serializePOIToText).join(`\n${SEPARATOR}\n`);
};

/**
 * plain textから1件のPOIデータをパースする。不正なデータの場合はnullを返す
 */
const parsePOIFromText = (text: string): POIData | null => {
  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) {
      fields[key] = value;
    }
  }

  if (!fields.x || !fields.y || !fields.r || !fields.N || !fields.mode) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    x: new BigNumber(fields.x),
    y: new BigNumber(fields.y),
    r: new BigNumber(fields.r),
    N: parseInt(fields.N, 10),
    mode: fields.mode as POIData["mode"],
    serializedPalette: fields.palette,
  };
};

/**
 * plain textからPOIリストをデシリアライズする
 */
export const deserializePOIListFromText = (text: string): POIData[] => {
  const blocks = text
    .split(SEPARATOR)
    .map((b) => b.trim())
    .filter(Boolean);
  const results: POIData[] = [];
  for (const block of blocks) {
    const poi = parsePOIFromText(block);
    if (poi) results.push(poi);
  }
  return results;
};

/**
 * 2つのPOIが同一の座標・パラメータを持つかを判定する
 */
const isSamePOI = (a: POIData, b: POIData): boolean =>
  a.x.eq(b.x) && a.y.eq(b.y) && a.r.eq(b.r) && a.N === b.N && a.mode === b.mode;

/**
 * 既存リストにインポート対象をマージし、重複を除外した結果を返す
 */
export const mergePOIList = (
  baseList: POIData[],
  importedList: POIData[],
): { result: POIData[]; newCount: number; duplicateCount: number } => {
  const result = [...baseList];
  let duplicateCount = 0;
  let newCount = 0;

  for (const poi of importedList) {
    const isDuplicate = baseList.some((base) => isSamePOI(base, poi));
    if (isDuplicate) {
      duplicateCount++;
    } else {
      result.push(poi);
      newCount++;
    }
  }

  return { result, newCount, duplicateCount };
};
