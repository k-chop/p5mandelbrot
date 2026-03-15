import { useSyncExternalStore } from "react";
import type { BatchRenderEntry } from "./batch-render-history";
import {
  getBatchRenderHistorySnapshot,
  subscribeToBatchRenderHistory,
} from "./batch-render-history";

export const useBatchRenderHistory = (): BatchRenderEntry[] => {
  return useSyncExternalStore(subscribeToBatchRenderHistory, getBatchRenderHistorySnapshot);
};
