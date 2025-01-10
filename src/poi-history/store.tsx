import { get, set } from "idb-keyval";
import type { POIHistory } from "./poi-history";

// poi-historyをindexedDBに読み書きする処理

/** indexedDBのキー */
const POI_HISTORY_KEY = "poi-history";

/**
 * 履歴データをindexedDBに保存
 */
export const saveHistoriesToStorage = (history: POIHistory[]) => {
  set(POI_HISTORY_KEY, history);
};

/**
 * indexedDBから履歴データを読む
 */
export const loadHistoriesFromStorage = async (): Promise<
  POIHistory[] | undefined
> => {
  return get(POI_HISTORY_KEY);
};
