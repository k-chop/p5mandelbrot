import { MandelbrotJob, JobType, CalcIterationJob } from "@/types";

let waitingList: MandelbrotJob[] = [];
let runningList: MandelbrotJob[] = [];

export const getWaitingList = (jobType: JobType) =>
  waitingList.filter((job) => job.type === jobType);

export const getWaitingListFiltered = (
  jobType: JobType,
  predicate: (job: CalcIterationJob) => boolean,
) =>
  waitingList.filter(
    (job) => job.type === jobType && predicate(job as CalcIterationJob),
  );

export const getRunningList = (jobType: JobType) =>
  runningList.filter((job) => job.type === jobType);

/**
 * 同じbatchIdを持つ実行待ちのJobを1つ返す
 */
export const getWaitingJobs = (batchId: string) => {
  return waitingList.find((job) => job.batchId === batchId);
};

/**
 * 同じbatchIdを持つ実行待ちのJobが存在するかどうか
 */
export const isWaitingJobExists = (batchId: string) => {
  return waitingList.some((job) => job.batchId === batchId);
};

/**
 * 指定したbatchIdのJobが全て実行完了しているかどうかを返す
 *
 * runningListが空で、実行待ちがいなければ完了している
 * FIXME: runningListもbatchIdを見なければならないのでは？
 */
export const isBatchCompleted = (batchId: string) =>
  isRunningListEmpty() && !isWaitingJobExists(batchId);

export const isRunningListEmpty = () => runningList.length === 0;

export const popWaitingList = (jobType: JobType) => {
  const job = waitingList.find((job) => job.type === jobType);
  if (job) {
    waitingList = waitingList.filter((j) => j.id !== job.id);
  }
  return job;
};

export const popWaitingListFiltered = (
  jobType: JobType,
  predicate: (job: CalcIterationJob) => boolean,
) => {
  const job = waitingList.find(
    (job) => job.type === jobType && predicate(job as CalcIterationJob),
  );
  if (job) {
    waitingList = waitingList.filter((j) => j.id !== job.id);
  }
  return job;
};

export const removeJobFromRunningList = (job: MandelbrotJob) => {
  runningList = runningList.filter((j) => j.id !== job.id);
};

export const clearTaskQueue = () => {
  waitingList = [];
  runningList = [];
};
