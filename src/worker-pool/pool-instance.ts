import { getStore, updateStore } from "@/store/store";
import { JobType, MandelbrotWorkerType } from "@/types";
import {
  onIterationWorkerIntermediateResult,
  onIterationWorkerProgress,
  onIterationWorkerResult,
} from "./callbacks/iteration-worker";
import {
  onRefOrbitWorkerProgress,
  onRefOrbitWorkerResult,
  onRefOrbitWorkerTerminated,
} from "./callbacks/ref-orbit-worker";
import { clearTaskQueue } from "./task-queue";
import {
  CalcIterationWorker,
  MandelbrotFacadeLike,
  RefOrbitWorker,
} from "./worker-facade";
import { clearBatchContext, tickWorkerPool } from "./worker-pool";
import { clearWorkerReference } from "./worker-reference";

type WorkerPool = MandelbrotFacadeLike[];

const pool: Map<JobType, WorkerPool> = new Map([
  ["calc-iteration", []],
  ["calc-ref-orbit", []],
]);

export const getWorkerPool = <T extends JobType>(jobType: T): WorkerPool =>
  pool.get(jobType)! as WorkerPool;
export const resetWorkerPool = (jobType: JobType) => pool.set(jobType, []);

/**
 * workerの数を返す
 * jobTypeが指定されていない場合は全workerが対象
 */
export const getWorkerCount = (jobType?: JobType) =>
  jobType == null
    ? [...pool.values()].reduce((acc, workers) => acc + workers.length, 0)
    : getWorkerPool(jobType).length;

/**
 * 全workerに対して処理を行う
 */
export const iterateAllWorker = <T>(f: (worker: MandelbrotFacadeLike) => T) => {
  for (const workers of pool.values()) {
    workers.forEach(f);
  }
};

/**
 * 全workerに対して非同期処理を行う
 */
export const iterateAllWorkerAsync = async <T>(
  f: (worker: MandelbrotFacadeLike) => Promise<T>,
) => {
  const promises = [];
  for (const workers of pool.values()) {
    promises.push(...workers.map(f));
  }
  return Promise.all(promises);
};

/**
 * 全workerをリセットする
 */
export const resetAllWorker = () => {
  [...pool.keys()].forEach(resetWorkerPool);
};

/**
 * 空いてるworkerがあればそのindexを返す
 */
export function findFreeWorkerIndex(jobType: JobType) {
  return getWorkerPool(jobType).findIndex(
    (worker) => worker.isReady() && !worker.isRunning(),
  );
}

/**
 * terminate判定用のworker indexを返す
 * 返り値は0 ~ 各workerの合計数 - 1の範囲になる
 */
export const calcNormalizedWorkerIndex = (
  jobType: JobType,
  workerIdx: number,
) => {
  // FIXME: jobTypeが増えたときに対応できていない
  if (jobType === "calc-ref-orbit") {
    const pool = getWorkerPool("calc-iteration");
    return pool.length + workerIdx;
  }

  return workerIdx;
};

/**
 * WorkerPoolを再構築する
 * countやworkerTypeが変わった場合に呼ばれる
 */
export async function prepareWorkerPool(
  count: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  console.debug(`prepareWorkerPool: ${count}, ${workerType}`);

  updateStore("mode", workerType);
  if (workerType === "normal") {
    updateStore("shouldReuseRefOrbit", false);
  }

  await resetWorkers();

  fillIterationWorkerPool(count, workerType);
  fillRefOrbitWorkerPool(1 /* 仮 */, workerType);
}

/**
 * WorkerPoolを溜まっていたJobごと全部リセットする
 */
export function resetWorkers() {
  iterateAllWorker((workerFacade) => {
    workerFacade.clearCallbacks();
    // fire and forget
    workerFacade.terminateAsync();
  });
  resetAllWorker();

  clearTaskQueue();
  clearWorkerReference();
  clearBatchContext();
}

/**
 * 指定した数になるまでWorkerPoolを埋める
 */
function fillIterationWorkerPool(
  upTo: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  let fillCount = 0;
  const pool = getWorkerPool("calc-iteration");

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const workerFacade = new CalcIterationWorker(workerType);

    workerFacade.onResult((...args) => {
      onIterationWorkerResult(...args);
      tickWorkerPool();
    });
    workerFacade.onIntermediateResult(onIterationWorkerIntermediateResult);
    workerFacade.onProgress(onIterationWorkerProgress);

    pool.push(workerFacade);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `Iteration Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}

function fillRefOrbitWorkerPool(
  upTo: number = 1,
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  if (workerType !== "perturbation") return;

  let fillCount = 0;
  const pool = getWorkerPool("calc-ref-orbit");

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const worker = new RefOrbitWorker();

    worker.init();

    worker.onResult((...args) => {
      onRefOrbitWorkerResult(...args);
      tickWorkerPool();
    });
    worker.onTerminate(onRefOrbitWorkerTerminated);
    worker.onProgress(onRefOrbitWorkerProgress);

    pool.push(worker);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `RefOrbit Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}
