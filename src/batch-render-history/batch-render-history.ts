import type { Rect } from "@/math/rect";

export interface WorkerRenderArea {
  workerId: string;
  workerIdx: number;
  rect: Rect;
  elapsed: number;
}

export interface BatchRenderEntry {
  batchId: string;
  startedAt: number;
  workers: WorkerRenderArea[];
}

const MAX_HISTORY = 5;

const pendingBatches = new Map<string, WorkerRenderArea[]>();
let history: BatchRenderEntry[] = [];
let snapshot: BatchRenderEntry[] = [];

const subscribers = new Set<() => void>();

const notify = () => {
  snapshot = history.map((entry) => ({ ...entry }));
  subscribers.forEach((cb) => cb());
};

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

export const finalizeBatch = (batchId: string, startedAt: number): void => {
  const workers = pendingBatches.get(batchId);
  if (workers == null) return;

  pendingBatches.delete(batchId);

  history = [{ batchId, startedAt, workers }, ...history].slice(0, MAX_HISTORY);

  notify();
};

export const subscribeToBatchRenderHistory = (callback: () => void): (() => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

export const getBatchRenderHistorySnapshot = (): BatchRenderEntry[] => {
  return snapshot;
};
