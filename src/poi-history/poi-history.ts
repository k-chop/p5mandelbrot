import { getCurrentPalette } from "@/camera/palette";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getResizedCanvasImageDataURL } from "@/p5-adapter/p5-adapter";
import { createNewPOIData } from "@/store/sync-storage/poi-list";
import type { POIData } from "@/types";
import { eventmit } from "eventmit";
import { useEffect, useState } from "react";
import { loadHistoriesFromStorage, saveHistoriesToStorage } from "./store";

// poi-historyのデータ保持と読み書きを行う処理

// POIDataに加えthumbnailも一緒に保持する
export type POIHistory = POIData & { imageDataUrl: string };

const poiHistory: POIHistory[] = [];
let initialized = false;

const event = eventmit<string>();
const POI_HISTORY_CHANGED = "poi-history-changed";
const MAX_HISTORY = 25;

/**
 * 指定パラメータと一致する最新の履歴からサムネイル画像を取得
 *
 * @param mandelbrotParams 一致を確認するパラメータ（デフォルトは現在の状態）
 */
export const getMatchingHistoryThumbnail = (
  mandelbrotParams = getCurrentParams(),
): string | null => {
  if (!initialized || poiHistory.length === 0) {
    return null;
  }

  const historyItem = poiHistory[poiHistory.length - 1];

  if (
    historyItem.x.eq(mandelbrotParams.x) &&
    historyItem.y.eq(mandelbrotParams.y) &&
    historyItem.r.eq(mandelbrotParams.r) &&
    historyItem.N === mandelbrotParams.N &&
    historyItem.mode === mandelbrotParams.mode
  ) {
    return historyItem.imageDataUrl;
  }

  return null;
};

/**
 * 末尾に履歴データを追加する
 */
export const addPOIToHistory = (poi: POIHistory) => {
  if (!initialized) {
    console.error("POI History is not initialized yet");
    return;
  }

  poiHistory.push(poi);
  // 常にMAX_HISTORY個以下に保つ
  if (poiHistory.length > MAX_HISTORY) {
    poiHistory.splice(0, poiHistory.length - MAX_HISTORY);
  }

  event.emit(POI_HISTORY_CHANGED);
  saveHistoriesToStorage(poiHistory);
};

/**
 * 今表示しているcanvasの内容と位置を履歴に追加する
 */
export const addCurrentLocationToPOIHistory = () => {
  const poi = createNewPOIData(getCurrentParams(), getCurrentPalette());
  const imageDataUrl = getResizedCanvasImageDataURL(100);

  addPOIToHistory({ ...poi, imageDataUrl });
};

/**
 * poi-historyを供給するhooks
 */
export const usePOIHistories = () => {
  const [value, setValue] = useState(() => poiHistory);

  useEffect(() => {
    const handler = () => {
      setValue([...poiHistory]);
    };
    event.on(handler);

    return () => {
      event.off(handler);
    };
  }, []);

  return value;
};

/**
 * poi-historyの初期化
 */
export const initializePOIHistory = () => {
  // fire and forget
  return loadHistoriesFromStorage().then((history) => {
    if (history) {
      poiHistory.push(...history);
    }
    console.debug("POI History initialized from storage", poiHistory);
    initialized = true;
  });
};
