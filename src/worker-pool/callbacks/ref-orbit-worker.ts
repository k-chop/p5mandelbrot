import { setRefOrbitCache } from "../reference-orbit-cache";
import { completeJob } from "../task-queue";
import {
  RefPointTerminatedCallback,
  RefPointProgressCallback,
  RefPointResultCallback,
} from "../worker-facade";
import { getBatchContext } from "../worker-pool";
import { removeWorkerReference } from "../worker-reference";

export const onCalcReferencePointWorkerTerminated: RefPointTerminatedCallback =
  (job) => {
    // ここで何をする予定だったんだっけ...
    // terminateされているということは外部からcancelされており、後始末はそっちで行われるはず
  };

export const onCalcReferencePointWorkerProgress: RefPointProgressCallback = (
  { progress },
  job,
) => {
  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.refProgress = progress;
};

export const onCalcReferencePointWorkerResult: RefPointResultCallback = (
  result,
  job,
) => {
  const { xn, blaTable, elapsed } = result;
  const batchContext = getBatchContext(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.refProgress = batchContext.mandelbrotParams.N;

  batchContext.xn = xn;
  batchContext.blaTable = blaTable;
  batchContext.spans.push({
    name: "reference_orbit",
    elapsed: Math.floor(elapsed),
  });

  // cacheに登録
  setRefOrbitCache({
    x: batchContext.mandelbrotParams.x,
    y: batchContext.mandelbrotParams.y,
    r: batchContext.mandelbrotParams.r,
    N: batchContext.mandelbrotParams.N,
    xn,
    blaTable,
  });

  completeJob(job);
  removeWorkerReference(job.id);
};
