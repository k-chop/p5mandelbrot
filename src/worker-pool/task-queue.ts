import { MandelbrotJob, JobType, CalcIterationJob } from "@/types";

let waitingList: MandelbrotJob[] = [];
let runningList: MandelbrotJob[] = [];

export const getWaitingList = (jobType?: JobType) =>
  jobType == null
    ? waitingList
    : waitingList.filter((job) => job.type === jobType);

export const getWaitingListFiltered = (
  jobType: JobType,
  predicate: (job: CalcIterationJob) => boolean,
) =>
  waitingList.filter(
    (job) => job.type === jobType && predicate(job as CalcIterationJob),
  );

export const getRunningList = (jobType?: JobType) =>
  jobType == null
    ? runningList
    : runningList.filter((job) => job.type === jobType);

/**
 * 同じbatchIdを持つ実行待ちのJobを返す
 */
export const getWaitingJobsInBatch = (batchId: string) => {
  return waitingList.filter((job) => job.batchId === batchId);
};

/**
 * 同じbatchIdを持つ実行中のJobを返す
 */
export const getRunningJobsInBatch = (batchId: string) => {
  return runningList.filter((job) => job.batchId === batchId);
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

export const countRunningJobs = () => runningList.length;
export const countWaitingJobs = () => waitingList.length;

export const hasWaitingJob = () => waitingList.length > 0;
export const hasRunningJob = () => runningList.length > 0;

/**
 * 待ちリストにJobを追加する
 */
export const addJob = (job: MandelbrotJob) => {
  waitingList.push(job);
};

/**
 * 実行中リストにJobを追加する
 */
export const startJob = (job: MandelbrotJob) => {
  runningList.push(job);
};

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

/**
 * 実行待ちリストから指定したbatchIdのJobを削除する
 */
export const removeBatchFromWaitingJobs = (batchId: string) => {
  waitingList = waitingList.filter((job) => job.batchId !== batchId);
};

/**
 * 実行中リストから指定したbatchIdのJobを削除する
 */
export const removeBatchFromRunningJobs = (batchId: string) => {
  runningList = runningList.filter((job) => job.batchId !== batchId);
};

export const clearTaskQueue = () => {
  waitingList = [];
  runningList = [];
};
