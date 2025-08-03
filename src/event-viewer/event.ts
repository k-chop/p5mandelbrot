import type { Rect } from "@/math/rect";
import { debounce } from "es-toolkit";
import { nowAbs, type AbsoluteTime } from "./time";

type EventBase = {
  time: AbsoluteTime;
};

// Worker Event ==================================================
export type WorkerEvent = EventBase & {
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
export type RendererEvent = EventBase & {
  /* common type */
} & (
    | {
        type: "iterationBufferProcessing";
        resolution: number; // 現状は一度に処理されるiterationBufferの解像度は同一になっているためeventにつき1つで良い
        count: number;
        remaining: number;
        rects: Rect[];
      }
    | {
        type: "bufferSizeExceeded";
        remaining: number;
      }
  );

// Job Event ==================================================
export type JobEvent = EventBase & {
  /* common type */
} & { type: "notImplemented" };

// イベント定義ここまで =======================================

export type AllTraceEvent = WorkerEvent | RendererEvent | JobEvent;

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

  notifyEventUpdate();
};

/**
 * 現在描画中のbatchIdに対するtrace eventを記録する
 */
type EventWithoutTime<T> = T extends { time: any } ? Omit<T, "time"> : T;

export function addTraceEvent<T extends keyof BatchTraceEvents>(
  category: T,
  event: EventWithoutTime<BatchTraceEvents[T][number]> & {
    time?: AbsoluteTime;
  },
): void {
  const batchTrace = traceMap.get(currentBatchId);
  if (batchTrace == null) return;

  const fullEvent = { ...event, time: event.time ?? nowAbs() };
  // NOTE: 引数の型チェックで守られているのでas anyで良い
  batchTrace[category].push(fullEvent as any);

  notifyEventUpdate();
}

/**
 * 指定したbatchIdのtrace eventを削除
 */
export const removeBatchTrace = (batchId: string) => {
  traceMap.delete(batchId);

  notifyEventUpdate();
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
const notifyEventUpdate = debounce(() => {
  updateSnapshot();
  eventSubscribers.forEach((callback) => callback());
}, 250);
