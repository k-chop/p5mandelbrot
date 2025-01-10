import {
  deserializeMandelbrotParams,
  serializePOIData,
} from "@/store/sync-storage/poi-list";
import { get, set } from "idb-keyval";
import type { POIHistory } from "./poi-history";

// poi-historyをindexedDBに読み書きする処理

/** indexedDBのキー */
const POI_HISTORY_KEY = "poi-history";

/**
 * indexedDBに保存するためにPOIHistoryの一部を文字列に変換して返す
 *
 * BigNumberはそのまま保存できないため
 */
const serializePOIHistory = (history: POIHistory) => {
  const poiData = serializePOIData(history);

  return {
    ...poiData,
    imageDataUrl: history.imageDataUrl,
  };
};

const deserializePOIHistory = (history: any): POIHistory => {
  return {
    ...deserializeMandelbrotParams(history),
    imageDataUrl: history.imageDataUrl,
  };
};

/**
 * 履歴データをserializeしてからindexedDBに保存
 */
export const saveHistoriesToStorage = (histories: POIHistory[]) => {
  const serialized = histories.map(serializePOIHistory);
  set(POI_HISTORY_KEY, serialized);
};

/**
 * indexedDBから履歴データを読む
 */
export const loadHistoriesFromStorage = async (): Promise<
  POIHistory[] | undefined
> => {
  const serialized = await get(POI_HISTORY_KEY);
  if (!serialized) return undefined;

  return serialized.map(deserializePOIHistory);
};
