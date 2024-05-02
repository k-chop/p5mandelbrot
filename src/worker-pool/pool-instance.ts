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

export function findFreeWorkerIndex(jobType: JobType) {
  return getWorkerPool(jobType).findIndex((worker) => !worker.isRunning());
}
