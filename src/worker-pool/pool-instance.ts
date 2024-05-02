import { JobType } from "@/types";
import { MandelbrotFacadeLike } from "./worker-facade";

const pool: Map<JobType, MandelbrotFacadeLike[]> = new Map([
  ["calc-iteration", []],
  ["calc-reference-point", []],
]);

export const getWorkerPool = (jobType: JobType) => pool.get(jobType)!;
export const resetWorkerPool = (jobType: JobType) => pool.set(jobType, []);
