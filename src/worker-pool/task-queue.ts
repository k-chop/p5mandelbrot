import { MandelbrotJob, JobType } from "@/types";

let waitingList: MandelbrotJob[] = [];
let runningList: MandelbrotJob[] = [];

const doneJobIds = new Set<string>();

const executableJobFilter = (job: MandelbrotJob) =>
  job.requiredJobIds.length === 0 ||
  job.requiredJobIds.every((id) => doneJobIds.has(id));

export const getWaitingJobs = (jobType?: JobType) =>
  jobType == null
    ? waitingList
    : waitingList.filter((job) => job.type === jobType);

export const getFilteredWaitingJobs = (
  jobType: JobType,
  predicate: (job: MandelbrotJob) => boolean,
) => waitingList.filter((job) => job.type === jobType && predicate(job));

export const getRunningJobs = (jobType?: JobType) =>
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
 * 指定したjobTypeのJobをqueueに積める余地があるかどうかを返す
 */
export const canQueueJob = <T>(jobType: JobType, pool: T[]) => {
  const hasFreeWorker = getRunningJobs(jobType).length < pool.length;

  if (jobType === "calc-iteration") {
    const waitingJobs = getFilteredWaitingJobs(jobType, executableJobFilter);
    return hasFreeWorker && waitingJobs.length > 0;
  }

  return hasFreeWorker && getWaitingJobs(jobType).length > 0;
};

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

export const popWaitingJob = (
  jobType: JobType,
  predicate: (job: MandelbrotJob) => boolean = () => true,
) => {
  const job = waitingList.find((job) => job.type === jobType && predicate(job));
  if (job) {
    waitingList = waitingList.filter((j) => j.id !== job.id);
  }
  return job;
};

export const popWaitingExecutableJob = (jobType: JobType) => {
  return popWaitingJob(jobType, executableJobFilter);
};

export const completeJob = (job: MandelbrotJob) => {
  markDoneJob(job.id);
  runningList = runningList.filter((j) => j.id !== job.id);
};

export const markDoneJob = (jobId: string) => {
  doneJobIds.add(jobId);
};

/**
 * 役目を終えたdoneJobIdを削除する
 */
export const deleteCompletedDoneJobs = () => {
  const remainingRequiredJobIds = new Set(
    ...getWaitingJobs().map((job) => job.requiredJobIds ?? []),
  );
  Array.from(doneJobIds.values()).forEach((id) => {
    if (remainingRequiredJobIds.has(id)) return;

    doneJobIds.delete(id);
  });
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
