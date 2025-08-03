import type { Rect } from "@/math/rect";
import { debounce } from "es-toolkit";
import { nowAbs, type AbsoluteTime } from "./time";

type EventBase = {
  time: AbsoluteTime;
};

// Worker Event ==================================================
type WorkerEvent = EventBase & {
  workerId: string;
} & (
    | {
        type: "launched" | "started" | "completed";
      }
    | {
        type: "progress";
        progress: number;
      }
  );

// Renderer Event ==================================================
type RendererEvent = EventBase & {} & {
  type: "iterationBufferProcessing";
  resolution: number; // 現状は一度に処理されるiterationBufferの解像度は同一になっているためeventにつき1つで良い
  count: number;
  remaining: number;
  rects: Rect[];
};

// 次はこれかな？
// WebGPUでの描画開始と描画完全完了をトラッキングしたいかも
// どう可視化するのかも含めて考えるぞい

// Job Event ==================================================
type JobEvent = EventBase & {};

type BatchTraceEvents = {
  worker: WorkerEvent[];
  renderer: RendererEvent[];
  job: JobEvent[];
};

export type BatchTrace = {
  // batchの開始時刻
  baseTime: AbsoluteTime;
} & BatchTraceEvents;

const traceMap = new Map<string, BatchTrace>(); // key = batchId

let currentBatchId = "";

// Subscription system for event updates
let eventSubscribers: Set<() => void> = new Set();

// Snapshots for useSyncExternalStore
let currentBatchSnapshot: BatchTrace | undefined = undefined;

/**
 * batchIdに対してtrace eventの記録を開始する
 */
export const startBatchTrace = (batchId: string) => {
  currentBatchId = batchId;

  traceMap.set(batchId, {
    baseTime: nowAbs(),
    worker: [],
    renderer: [],
    job: [],
  });

  notifyEventUpdateDebounced();
};

type UnArray<T> = T extends (infer U)[] ? U : never;
type PartialPick<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

/**
 * 現在描画中のbatchIdに対するtrace eventを記録する
 */
export const addTraceEvent = <T extends keyof BatchTraceEvents>(
  type: T,
  event: PartialPick<UnArray<BatchTraceEvents[T]>, "time">,
) => {
  const batchTrace = traceMap.get(currentBatchId);
  if (batchTrace == null) return;

  // timeが既にあるなら上書きしない
  if ("time" in event) {
    // 引数の型チェックで守られているのでas anyで良い
    batchTrace[type].push({ ...event } as any);

    notifyEventUpdateDebounced();
    return;
  }

  batchTrace[type].push({ ...event, time: nowAbs() } as any);

  notifyEventUpdateDebounced();
};

/**
 * 指定したbatchIdのtrace eventを削除
 */
export const removeBatchTrace = (batchId: string) => {
  traceMap.delete(batchId);

  notifyEventUpdateDebounced();
};

/**
 * 現在のバッチIDを取得
 */
export const getCurrentBatchId = (): string => currentBatchId;

/**
 * 現在のバッチのトレース情報を取得
 */
export const getCurrentBatchTrace = (): BatchTrace | undefined => {
  return traceMap.get(currentBatchId);
};

/**
 * 指定したバッチIDのトレース情報を取得
 */
export const getBatchTrace = (batchId: string): BatchTrace | undefined => {
  return traceMap.get(batchId);
};

/**
 * 全てのバッチIDの一覧を取得
 */
export const getAllBatchIds = (): string[] => {
  return Array.from(traceMap.keys());
};

/**
 * useSyncExternalStore用のsnapshot更新関数
 */
const updateSnapshot = (): void => {
  const currentTrace = traceMap.get(currentBatchId);
  currentBatchSnapshot = currentTrace ? { ...currentTrace } : undefined;
};

/**
 * useSyncExternalStore用のスナップショット取得関数
 */
export const getCurrentBatchSnapshot = (): BatchTrace | undefined =>
  currentBatchSnapshot;

/**
 * useSyncExternalStore用の購読関数
 */
export const subscribeToEventUpdates = (callback: () => void) => {
  eventSubscribers.add(callback);
  return () => {
    eventSubscribers.delete(callback);
  };
};

/**
 * イベント更新の通知を送信
 */
const notifyEventUpdate = () => {
  updateSnapshot();
  eventSubscribers.forEach((callback) => callback());
};
const notifyEventUpdateDebounced = debounce(notifyEventUpdate, 250);

/** test */
export const test_printBatchTrace = () =>
  console.log(traceMap.get(currentBatchId));
