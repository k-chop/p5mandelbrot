import { upsertIterationCache } from "@/aggregator";
import { renderToResultBuffer } from "@/camera";
import { WorkerIntermediateResult, CalcIterationJob } from "@/types";
import { completeJob, isBatchCompleted } from "../task-queue";
import { WorkerProgressCallback, WorkerResultCallback } from "../worker-facade";
import { getBatchContext } from "../worker-pool";

export const onCalcIterationWorkerProgress: WorkerProgressCallback = (
  result,
  job,
) => {
  const { progress } = result;
  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.progressMap.set(job.id, progress);
};

export const onCalcIterationWorkerResult: WorkerResultCallback = (
  result,
  job,
) => {
  const { iterations, elapsed } = result;
  const { rect } = job;
  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  const iterationsResult = new Uint32Array(iterations);
  upsertIterationCache(rect, iterationsResult, {
    width: rect.width,
    height: rect.height,
  });

  // jobを完了させる
  batchContext.progressMap.set(job.id, 1.0);

  completeJob(job);
  runningWorkerFacadeMap.delete(job.id);

  batchContext.spans.push({
    name: `iteration_${job.workerIdx}`,
    elapsed: Math.floor(elapsed),
  });

  renderToResultBuffer(rect);

  // バッチ全体が完了していたらonComplete callbackを呼ぶ
  if (isBatchCompleted(job.batchId)) {
    const finishedAt = performance.now();
    batchContext.finishedAt = finishedAt;
    const elapsed = finishedAt - batchContext.startedAt;

    batchContext.onComplete(elapsed);
  }
};

export const onCalcIterationWorkerIntermediateResult = (
  result: WorkerIntermediateResult,
  job: CalcIterationJob,
) => {
  const { iterations, resolution } = result;
  const { rect } = job;

  // 停止が間に合わなかったケース。何もしない
  if (getBatchContext(job.batchId) == null) {
    return;
  }

  upsertIterationCache(rect, new Uint32Array(iterations), resolution);
  renderToResultBuffer(rect);
};
