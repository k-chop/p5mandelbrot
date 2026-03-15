import { finalizeBatch, recordWorkerResult } from "@/batch-render-history/batch-render-history";
import { addTraceEvent } from "@/event-viewer/event";
import {
  consolidateIterationCache,
  notifyIterationCacheUpdate,
  upsertIterationCache,
} from "@/iteration-buffer/iteration-buffer";
import { addIterationBuffer } from "@/rendering/renderer";
import type { CalcIterationJob, IterationIntermediateResult } from "@/types";
import { getWorkerId } from "../pool-instance";
import { completeJob, hasWaitingJob, isBatchCompleted } from "../task-queue";
import type { IterationProgressCallback, IterationResultCallback } from "../worker-facade";
import { getBatchContext } from "../worker-pool";
import { removeWorkerReference } from "../worker-reference";

export const onIterationWorkerProgress: IterationProgressCallback = (result, job) => {
  const { progress } = result;
  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.progressMap.set(job.id, progress);
};

export const onIterationWorkerResult: IterationResultCallback = (result, job) => {
  const { iterations, elapsed } = result;
  const { rect } = job;
  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  const isSuperSampled = batchContext.mandelbrotParams.isSuperSampling;
  const scale = isSuperSampled ? 2 : 1;
  const iterationsResult = new Uint32Array(iterations);
  const iterBuffer = upsertIterationCache(
    rect,
    iterationsResult,
    {
      width: rect.width * scale,
      height: rect.height * scale,
    },
    isSuperSampled,
  );

  // jobを完了させる
  batchContext.progressMap.set(job.id, 1.0);
  addTraceEvent("worker", { type: "completed", workerId: getWorkerId(job) });

  completeJob(job);
  removeWorkerReference(job.id);

  batchContext.spans.push({
    name: `iteration_${job.workerIdx}`,
    elapsed: Math.floor(elapsed),
  });

  recordWorkerResult(job.batchId, getWorkerId(job), job.workerIdx ?? 0, rect, elapsed);

  batchContext.onChangeProgress();

  addIterationBuffer(rect, [iterBuffer], isSuperSampled);

  // UIに変更を通知
  notifyIterationCacheUpdate();

  // バッチ全体が完了していたらonComplete callbackを呼ぶ
  if (isBatchCompleted(job.batchId)) {
    // 他バッチの待ちジョブがある場合は統合をスキップし、次バッチ完了時に統合する
    if (!hasWaitingJob()) {
      consolidateIterationCache();
    }

    const finishedAt = performance.now();
    batchContext.finishedAt = finishedAt;
    const elapsed = finishedAt - batchContext.startedAt;

    finalizeBatch(job.batchId, batchContext.startedAt);

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

  const iterBuffer = upsertIterationCache(rect, new Uint32Array(iterations), resolution);
  addIterationBuffer(rect, [iterBuffer]);
};
