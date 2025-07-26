import { useSyncExternalStore } from "react";
import type { IterationBuffer } from "../types";
import {
  getIterationCacheSnapshot,
  subscribeToIterationCacheUpdates,
} from "./iteration-buffer";

/**
 * iteration cacheの変更を自動で検知するReactフック
 * useSyncExternalStoreを使用してパフォーマンス最適化
 */
export const useIterationCache = (): IterationBuffer[] => {
  return useSyncExternalStore(
    subscribeToIterationCacheUpdates,
    getIterationCacheSnapshot,
  );
};
