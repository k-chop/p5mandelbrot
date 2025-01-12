import { getIterationCache, upsertIterationCache } from "@/aggregator";
import { renderToMainBuffer } from "@/camera/camera";
import { CalcIterationJob, IterationIntermediateResult } from "@/types";
import { completeJob, isBatchCompleted } from "../task-queue";
import {
  IterationProgressCallback,
  IterationResultCallback,
} from "../worker-facade";
import { getBatchContext } from "../worker-pool";
import { removeWorkerReference } from "../worker-reference";

export const onIterationWorkerProgress: IterationProgressCallback = (
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

export const onIterationWorkerResult: IterationResultCallback = (
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
  const iterBuffer = upsertIterationCache(rect, iterationsResult, {
    width: rect.width,
    height: rect.height,
  });

  // jobを完了させる
  batchContext.progressMap.set(job.id, 1.0);

  completeJob(job);
  removeWorkerReference(job.id);

  batchContext.spans.push({
    name: `iteration_${job.workerIdx}`,
    elapsed: Math.floor(elapsed),
  });

  batchContext.onChangeProgress();

  renderToMainBuffer(rect, [iterBuffer]);

  // バッチ全体が完了していたらonComplete callbackを呼ぶ
  if (isBatchCompleted(job.batchId)) {
    const finishedAt = performance.now();
    batchContext.finishedAt = finishedAt;
    const elapsed = finishedAt - batchContext.startedAt;

    console.log("Iteration Buffer length: ", getIterationCache().length);

    batchContext.onComplete(elapsed);
  }
};

export const onIterationWorkerIntermediateResult = (
  result: IterationIntermediateResult,
  job: CalcIterationJob,
) => {
  const { iterations, resolution } = result;
  const { rect } = job;

  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.onChangeProgress();

  const iterBuffer = upsertIterationCache(
    rect,
    new Uint32Array(iterations),
    resolution,
  );
  renderToMainBuffer(rect, [iterBuffer]);
};
