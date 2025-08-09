import { JobType, MandelbrotJob } from "@/types";

let waitingList: MandelbrotJob[] = [];
let runningList: MandelbrotJob[] = [];

const doneJobIds = new Set<string>();

const executableJobFilter = (job: MandelbrotJob) =>
  job.requiredJobIds.length === 0 || job.requiredJobIds.every((id) => doneJobIds.has(id));

/**
 * jobTypeに対応する実行待ちのJobを返す
 * 追加の条件も与えられる
 */
export const getWaitingJobs = (
  jobType?: JobType,
  predicate: (job: MandelbrotJob) => boolean = () => true,
) =>
  jobType == null
    ? waitingList
    : waitingList.filter((job) => job.type === jobType && predicate(job));

/**
 * jobTypeに対応する実行中のJobを返す
 * 追加の条件も与えられる
 */
export const getRunningJobs = (
  jobType?: JobType,
  predicate: (job: MandelbrotJob) => boolean = () => true,
) =>
  jobType == null
    ? runningList
    : runningList.filter((job) => job.type === jobType && predicate(job));

/**
 * 指定したbatchIdを持つ実行待ちのJobを返す
 */
export const getWaitingJobsInBatch = (batchId: string) => {
  return waitingList.filter((job) => job.batchId === batchId);
};

/**
 * 指定したbatchIdを持つ実行中のJobを返す
 */
export const getRunningJobsInBatch = (batchId: string) => {
  return runningList.filter((job) => job.batchId === batchId);
};

/**
 * 指定したbatchIdを持つ実行待ちのJobが存在するかどうかを返す
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

  const waitingJobs = getWaitingJobs(jobType, executableJobFilter);
  return hasFreeWorker && waitingJobs.length > 0;
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

/**
 * jobTypeに対応する実行可能なJobを取り出す
 *
 * 実行可能とは、requiredJobIdsが空か、全て完了していることを指す
 */
export const popWaitingExecutableJob = (jobType: JobType) => {
  const job = waitingList.find((job) => job.type === jobType && executableJobFilter(job));
  if (job) {
    waitingList = waitingList.filter((j) => j.id !== job.id);
  }
  return job;
};

/**
 * jobをdoneとしてマークし、実行中リストから削除する
 */
export const completeJob = (job: MandelbrotJob) => {
  markDoneJob(job.id);
  runningList = runningList.filter((j) => j.id !== job.id);
};

/**
 * jobをdoneとしてマークする
 * マークされると、このjobIdがrequiredJobIdsに含まれているjobが実行可能になる
 */
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

/**
 * 実行待ちリストをクリアする
 */
export const clearTaskQueue = () => {
  waitingList = [];
  runningList = [];
};
