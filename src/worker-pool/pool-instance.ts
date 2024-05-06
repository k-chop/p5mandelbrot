import { JobType } from "@/types";
import {
  CalcIterationWorker,
  CalcReferencePointWorker,
  MandelbrotFacadeLike,
} from "./worker-facade";

const pool: Map<JobType, MandelbrotFacadeLike[]> = new Map([
  ["calc-iteration", []],
  ["calc-reference-point", []],
]);

type IterationWorkerPool = CalcIterationWorker[];
type ReferencePointWorkerPool = CalcReferencePointWorker[];
type WorkerPool<T extends JobType> = T extends "calc-iteration"
  ? IterationWorkerPool
  : ReferencePointWorkerPool;

export const getWorkerPool = <T extends JobType>(jobType: T): WorkerPool<T> =>
  pool.get(jobType)! as WorkerPool<T>;
export const resetWorkerPool = (jobType: JobType) => pool.set(jobType, []);

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

export function findFreeWorkerIndex(jobType: JobType) {
  return getWorkerPool(jobType).findIndex(
    (worker) => worker.isReady() && !worker.isRunning(),
  );
}
