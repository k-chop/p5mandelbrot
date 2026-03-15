import { useSyncExternalStore } from "react";
import type { BatchRenderEntry } from "./batch-render-history";
import {
  getBatchRenderHistorySnapshot,
  subscribeToBatchRenderHistory,
} from "./batch-render-history";

/**
 * バッチレンダリング履歴の変更を自動で検知するReactフック
 */
export const useBatchRenderHistory = (): BatchRenderEntry[] => {
  return useSyncExternalStore(subscribeToBatchRenderHistory, getBatchRenderHistorySnapshot);
};
