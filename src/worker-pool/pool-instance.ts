import { JobType, MandelbrotWorkerType } from "@/types";
import {
  CalcIterationWorker,
  CalcReferencePointWorker,
  MandelbrotFacadeLike,
} from "./worker-facade";
import { getStore, updateStore } from "@/store/store";
import { clearTaskQueue } from "./task-queue";
import { clearWorkerReference } from "./worker-reference";
import {
  onCalcIterationWorkerResult,
  onCalcIterationWorkerIntermediateResult,
  onCalcIterationWorkerProgress,
} from "./callbacks/iteration-worker";
import {
  onCalcReferencePointWorkerResult,
  onCalcReferencePointWorkerTerminated,
  onCalcReferencePointWorkerProgress,
} from "./callbacks/ref-orbit-worker";
import { clearBatchContext, tickWorkerPool } from "./worker-pool";

type WorkerPool = MandelbrotFacadeLike[];

const pool: Map<JobType, WorkerPool> = new Map([
  ["calc-iteration", []],
  ["calc-reference-point", []],
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
  if (jobType === "calc-reference-point") {
    const pool = getWorkerPool("calc-iteration");
    return pool.length + workerIdx;
  }

  return workerIdx;
};

/**
 * WorkerPoolを再構築する
 * countやworkerTypeが変わった場合に呼ばれる
 */
export function prepareWorkerPool(
  count: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  console.debug(`prepareWorkerPool: ${count}, ${workerType}`);

  updateStore("mode", workerType);
  if (workerType === "normal") {
    updateStore("shouldReuseRefOrbit", false);
  }

  resetWorkers();

  fillCalcIterationWorkerPool(count, workerType);
  fillCalcReferencePointWorkerPool(1 /* 仮 */, workerType);
}

/**
 * WorkerPoolを溜まっていたJobごと全部リセットする
 */
export function resetWorkers() {
  iterateAllWorker((workerFacade) => {
    workerFacade.clearCallbacks();
    workerFacade.terminate();
  });
  resetAllWorker();

  clearTaskQueue();
  clearWorkerReference();
  clearBatchContext();
}

/**
 * 指定した数になるまでWorkerPoolを埋める
 */
function fillCalcIterationWorkerPool(
  upTo: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  let fillCount = 0;
  const pool = getWorkerPool("calc-iteration");

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const workerFacade = new CalcIterationWorker(workerType);

    workerFacade.onResult((...args) => {
      onCalcIterationWorkerResult(...args);
      tickWorkerPool();
    });
    workerFacade.onIntermediateResult(onCalcIterationWorkerIntermediateResult);
    workerFacade.onProgress(onCalcIterationWorkerProgress);

    pool.push(workerFacade);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `Iteration Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}

function fillCalcReferencePointWorkerPool(
  upTo: number = 1,
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  if (workerType !== "perturbation") return;

  let fillCount = 0;
  const pool = getWorkerPool("calc-reference-point");

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const worker = new CalcReferencePointWorker();

    worker.init();

    worker.onResult((...args) => {
      onCalcReferencePointWorkerResult(...args);
      tickWorkerPool();
    });
    worker.onTerminate(onCalcReferencePointWorkerTerminated);
    worker.onProgress(onCalcReferencePointWorkerProgress);

    pool.push(worker);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `RefPoint Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}
