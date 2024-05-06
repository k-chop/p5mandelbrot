import { JobType } from "@/types";
import { MandelbrotFacadeLike } from "./worker-facade";

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
