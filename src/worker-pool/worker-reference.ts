import { MandelbrotFacadeLike } from "./worker-facade";

type JobId = string;
const runningWorkerFacadeMap = new Map<JobId, MandelbrotFacadeLike>();

export const removeWorkerReference = (jobId: JobId) => {
  runningWorkerFacadeMap.delete(jobId);
};

export const clearWorkerReference = () => {
  runningWorkerFacadeMap.clear();
};

export const setWorkerReference = (
  jobId: JobId,
  worker: MandelbrotFacadeLike,
) => {
  runningWorkerFacadeMap.set(jobId, worker);
};

export const popWorkerReference = (jobId: JobId) => {
  const result = runningWorkerFacadeMap.get(jobId);
  runningWorkerFacadeMap.delete(jobId);
  return result;
};
