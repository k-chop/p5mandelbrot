import { useSyncExternalStore } from "react";
import { getIterationCache, subscribeToIterationCacheUpdates } from "./iteration-buffer";
import type { IterationBuffer } from "../types";

/**
 * iteration cacheの変更を自動で検知するReactフック
 * useSyncExternalStoreを使用してパフォーマンス最適化
 */
export const useIterationCache = (): IterationBuffer[] => {
  return useSyncExternalStore(
    subscribeToIterationCacheUpdates,
    getIterationCache,
    getIterationCache // SSR用のgetServerSnapshot
  );
};