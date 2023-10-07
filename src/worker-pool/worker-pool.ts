import {
  BatchContext,
  MandelbrotJob,
  MandelbrotRenderingUnit,
  MandelbrotWorkerType,
  mandelbrotWorkerTypes,
} from "@/types";
import {
  WorkerIntermediateResultCallback,
  WorkerProgressCallback,
  WorkerResultCallback,
  WorkerFacade,
  MandelbrotFacadeLike,
} from "./worker-facade";
import { upsertIterationCache } from "@/aggregator";
import { renderToResultBuffer } from "@/camera";
import { getStore, updateStore } from "@/store/store";

let waitingList: MandelbrotJob[] = [];
let runningList: MandelbrotJob[] = [];
let pool: MandelbrotFacadeLike[] = [];

type JobId = string;
type BatchId = string;

const runningWorkerFacadeMap = new Map<JobId, MandelbrotFacadeLike>();
const batchContextMap = new Map<BatchId, BatchContext>();

const onWorkerProgress: WorkerProgressCallback = (result, job) => {
  const { progress } = result;

  batchContextMap.get(job.batchId)?.progressMap?.set(job.id, progress);
};

const onWorkerResult: WorkerResultCallback = (result, job) => {
  const { iterations } = result;
  const { rect } = job;

  const iterationsResult = new Uint32Array(iterations);
  upsertIterationCache(rect, iterationsResult, {
    width: rect.width,
    height: rect.height,
  });

  // jobを完了させる
  batchContextMap.get(job.batchId)?.progressMap?.set(job.id, 1.0);
  runningList = runningList.filter((j) => j.id !== job.id);

  runningWorkerFacadeMap.delete(job.id);

  renderToResultBuffer(rect);

  // バッチが完了していたらcallbackを呼び、BatchContextを削除する
  // FIXME: waitingListのbatchIdも見る必要がある？
  if (runningList.length === 0 && waitingList.length === 0) {
    const batchContext = batchContextMap.get(job.batchId)!;
    const elapsed = performance.now() - batchContext.startedAt;
    batchContext.onComplete(elapsed);
    batchContextMap.delete(job.batchId);
  }

  tick();
};

const onWorkerIntermediateResult: WorkerIntermediateResultCallback = (
  result,
  job,
) => {
  const { iterations, resolution } = result;
  const { rect } = job;

  upsertIterationCache(rect, new Uint32Array(iterations), resolution);
  renderToResultBuffer(rect);
};

export const getWorkerCount = (): number => {
  return pool.length;
};

export const cycleWorkerType = (): MandelbrotWorkerType => {
  const currentMode = getStore("mode");

  const currentIndex = mandelbrotWorkerTypes.findIndex(
    (v) => v === currentMode,
  );

  const nextMode =
    mandelbrotWorkerTypes[(currentIndex + 1) % mandelbrotWorkerTypes.length];

  return nextMode;
};

export function prepareWorkerPool(
  count: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  updateStore("mode", workerType);

  resetWorkers();

  for (let i = 0; i < count; i++) {
    const workerFacade = new WorkerFacade(workerType);

    workerFacade.onResult(onWorkerResult);
    workerFacade.onIntermediateResult(onWorkerIntermediateResult);
    workerFacade.onProgress(onWorkerProgress);

    pool.push(workerFacade);
  }
}

/**
 * WorkerPoolを溜まっていたJobごと全部リセットする
 */
export function resetWorkers() {
  pool.forEach((workerFacade) => {
    workerFacade.clearCallbacks();
    workerFacade.terminate();
  });
  pool = [];

  // queueに溜まってるJobも全部消す
  runningList = [];
  waitingList = [];

  runningWorkerFacadeMap.clear();
  batchContextMap.clear();
}

export function registerBatch(
  units: MandelbrotRenderingUnit[],
  batchContext: Omit<BatchContext, "progressMap" | "startedAt">,
) {
  const batchId = crypto.randomUUID();
  const progressMap = new Map<string, number>();

  for (const unit of units) {
    const job = {
      ...unit,
      id: crypto.randomUUID(),
      batchId,
    };

    waitingList.push(job);
    progressMap.set(job.id, 0);
  }

  batchContextMap.set(batchId, {
    ...batchContext,
    progressMap,
    startedAt: performance.now(),
  });

  tick();
}

function findFreeWorkerFacade() {
  return pool.find((worker) => !worker.isRunning());
}

function tick() {
  while (runningList.length < pool.length && waitingList.length > 0) {
    const job = waitingList.shift()!;
    const workerFacade = findFreeWorkerFacade();

    if (!workerFacade) break;

    start(workerFacade, job);
  }
}

function start(workerFacade: MandelbrotFacadeLike, job: MandelbrotJob) {
  const batchContext = batchContextMap.get(job.batchId)!;
  workerFacade.startCalculate(job, batchContext);

  runningList.push(job);
  runningWorkerFacadeMap.set(job.id, workerFacade);
}

/**
 * 指定したバッチIDのジョブをキャンセルする
 */
export async function terminate(batchId: string) {
  // 待ちリストからは単純に削除
  waitingList = waitingList.filter((job) => job.batchId !== batchId);

  const runningJobs = runningList.filter((job) => job.batchId === batchId);

  const promises = runningJobs.map((job) => {
    const workerFacade = runningWorkerFacadeMap.get(job.id)!;
    return workerFacade.terminateAsync();
  });

  await Promise.all(promises);

  runningList = runningList.filter((job) => job.batchId !== batchId);
  batchContextMap.delete(batchId);

  tick();
}
