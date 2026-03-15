import type { Rect } from "@/math/rect";

export interface WorkerRenderArea {
  workerId: string;
  workerIdx: number;
  rect: Rect;
  elapsed: number;
}

export interface BatchRenderEntry {
  batchId: string;
  seq: number;
  elapsed: number;
  workers: WorkerRenderArea[];
}

const MAX_HISTORY = 10;

let batchSeq = 0;
const pendingBatches = new Map<string, WorkerRenderArea[]>();
let history: BatchRenderEntry[] = [];
let snapshot: BatchRenderEntry[] = [];

const subscribers = new Set<() => void>();

const notify = () => {
  snapshot = history.map((entry) => ({ ...entry }));
  subscribers.forEach((cb) => cb());
};

/**
 * worker完了時に描画エリアを記録する
 *
 * バッチが進行中の間pendingBatchesに蓄積され、finalizeBatchで確定される
 */
export const recordWorkerResult = (
  batchId: string,
  workerId: string,
  workerIdx: number,
  rect: Rect,
  elapsed: number,
): void => {
  if (!pendingBatches.has(batchId)) {
    pendingBatches.set(batchId, []);
  }
  pendingBatches.get(batchId)!.push({ workerId, workerIdx, rect, elapsed });
};

/**
 * バッチ完了時にpendingから履歴へ移動し、subscriberに通知する
 *
 * 通し番号(seq)を採番し、履歴はMAX_HISTORY件を超えると古いものから削除される
 */
export const finalizeBatch = (batchId: string, elapsed: number): void => {
  const workers = pendingBatches.get(batchId);
  if (workers == null) return;

  pendingBatches.delete(batchId);
  batchSeq++;

  history = [{ batchId, seq: batchSeq, elapsed, workers }, ...history].slice(0, MAX_HISTORY);

  notify();
};

/**
 * useSyncExternalStore用のsubscribe関数
 */
export const subscribeToBatchRenderHistory = (callback: () => void): (() => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

/**
 * useSyncExternalStore用のsnapshotを返す
 *
 * 未変化のときに参照が変わらないように取っておいたsnapshotを返す
 */
export const getBatchRenderHistorySnapshot = (): BatchRenderEntry[] => {
  return snapshot;
};
