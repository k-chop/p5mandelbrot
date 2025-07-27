import { nowAbs, type AbsoluteTime } from "./time";

type EventBase = {
  time: AbsoluteTime;
};

// Worker Event ==================================================
type WorkerEvent = EventBase & {
  workerIdx: number;
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
type RendererEvent = EventBase & {};

// Job Event ==================================================
type JobEvent = EventBase & {};

type BatchTraceEvents = {
  worker: WorkerEvent[];
  renderer: RendererEvent[];
  job: JobEvent[];
};

type BatchTrace = {
  // batchの開始時刻
  baseTime: AbsoluteTime;
} & BatchTraceEvents;

const traceMap = new Map<string, BatchTrace>(); // key = batchId

let currentBatchId = "";

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
    return;
  }

  batchTrace[type].push({ ...event, time: nowAbs() } as any);
};

/**
 * 指定したbatchIdのtrace eventを削除
 */
export const removeBatchTrace = (batchId: string) => {
  traceMap.delete(batchId);
};

/** test */
export const test_printBatchTrace = () =>
  console.log(traceMap.get(currentBatchId));
