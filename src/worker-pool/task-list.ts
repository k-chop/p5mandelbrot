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
