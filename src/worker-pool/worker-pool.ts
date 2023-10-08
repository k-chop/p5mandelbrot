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
const acceptingBatchIds = new Set<BatchId>();

export const getProgressString = (batchId: BatchId) => {
  const batchContext = batchContextMap.get(batchId);

  if (!batchContext) return "";

  const { progressMap } = batchContext;
  const progressList = Array.from(progressMap.values());
  const progress =
    progressList.reduce((a, b) => a + b, 0) / progressList.length;

  return `${Math.floor(progress * 100)}%`;
};

const onWorkerProgress: WorkerProgressCallback = (result, job) => {
  const { progress } = result;
  const batchContext = batchContextMap.get(job.batchId);

  // 停止が間に合わなかったケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.progressMap.set(job.id, progress);
};

const onWorkerResult: WorkerResultCallback = (result, job) => {
  const { iterations } = result;
  const { rect } = job;
  const batchContext = batchContextMap.get(job.batchId);

  // 停止が間に合わなかったケース。何もしない
  if (batchContext == null) {
    return;
  }

  const iterationsResult = new Uint32Array(iterations);
  upsertIterationCache(rect, iterationsResult, {
    width: rect.width,
    height: rect.height,
  });

  // jobを完了させる
  batchContext.progressMap.set(job.id, 1.0);
  runningList = runningList.filter((j) => j.id !== job.id);

  runningWorkerFacadeMap.delete(job.id);

  renderToResultBuffer(rect);

  // バッチが完了していたらcallbackを呼び、BatchContextを削除する
  const waitingJobInSameBatch = waitingList.find(
    (j) => j.batchId === job.batchId,
  );

  if (runningList.length === 0 && waitingJobInSameBatch == null) {
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

  // 停止が間に合わなかったケース。何もしない
  if (!batchContextMap.has(job.batchId)) {
    return;
  }

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

/**
 * 指定した数になるまでWorkerPoolを埋める
 */
function fillWorkerFacade(
  upTo: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  let fillCount = 0;

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const workerFacade = new WorkerFacade(workerType);

    workerFacade.onResult(onWorkerResult);
    workerFacade.onIntermediateResult(onWorkerIntermediateResult);
    workerFacade.onProgress(onWorkerProgress);

    pool.push(workerFacade);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}

/**
 * WorkerPoolを再構築する
 * countやworkerTypeが変わった場合に呼ばれる
 */
export function prepareWorkerPool(
  count: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  console.log(`prepareWorkerPool: ${count}, ${workerType}`);

  updateStore("mode", workerType);

  resetWorkers();

  fillWorkerFacade(count, workerType);
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
  batchId: BatchId,
  units: MandelbrotRenderingUnit[],
  batchContext: Omit<BatchContext, "progressMap" | "startedAt">,
) {
  console.log("registerBatch", batchId, units.length);

  if (!acceptingBatchIds.has(batchId)) {
    console.log("Denied: already cancelled. batchId =", batchId);
    return;
  }
  // FIXME: ここじゃないけどprogressを表示できるようにする

  // FIXME: ここじゃないけどworker数と分割数を別にできるようにする

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
  const hasWaitingJob = waitingList.length > 0;

  while (runningList.length < pool.length && waitingList.length > 0) {
    const job = waitingList.shift()!;
    const workerFacade = findFreeWorkerFacade();

    if (!workerFacade) break;

    start(workerFacade, job);
  }

  if (hasWaitingJob) {
    console.info(
      `running: ${runningList.length}, waiting: ${waitingList.length}`,
    );
  }
}

function start(workerFacade: MandelbrotFacadeLike, job: MandelbrotJob) {
  const batchContext = batchContextMap.get(job.batchId)!;
  workerFacade.startCalculate(job, batchContext);

  runningList.push(job);
  runningWorkerFacadeMap.set(job.id, workerFacade);
}

export function startBatch(batchId: BatchId) {
  acceptingBatchIds.add(batchId);
}

export function isAcceptingBatch(batchId: BatchId) {
  return acceptingBatchIds.has(batchId);
}

/**
 * 指定したバッチIDのジョブをキャンセルする
 */
export function cancelBatch(batchId: string) {
  acceptingBatchIds.delete(batchId);

  // 待ちリストからは単純に削除
  waitingList = waitingList.filter((job) => job.batchId !== batchId);

  const runningJobs = runningList.filter((job) => job.batchId === batchId);

  console.log("cancelBatch", batchId, runningJobs.length, runningList);

  const facades = runningJobs.map((job) => {
    const facade = runningWorkerFacadeMap.get(job.id);
    runningWorkerFacadeMap.delete(job.id);

    return facade;
  });

  for (const facade of facades) {
    if (!facade) continue;

    facade.clearCallbacks();
    facade.terminate();
  }
  removeFromPool(facades);

  fillWorkerFacade();

  runningList = runningList.filter((job) => job.batchId !== batchId);
  batchContextMap.delete(batchId);

  tick();
}

function removeFromPool(facades: (MandelbrotFacadeLike | undefined)[]) {
  let removeCount = 0;

  for (const facade of facades) {
    if (!facade) continue;
    const index = pool.indexOf(facade);

    if (index !== -1) {
      pool.splice(index, 1);
      removeCount++;
    }
  }

  if (removeCount > 0) {
    console.info(
      `Worker removed: remove count = ${removeCount}, pool size = ${pool.length}`,
    );
  }
}
