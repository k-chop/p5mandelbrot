import {
  BatchContext,
  CalcIterationJob,
  CalcReferencePointJob,
  InitialOmittedBatchContextKeys,
  JobType,
  MandelbrotJob,
  MandelbrotRenderingUnit,
  MandelbrotWorkerType,
  ResultSpans,
  mandelbrotWorkerTypes,
} from "@/types";
import {
  CalcIterationWorker,
  MandelbrotFacadeLike,
  CalcReferencePointWorker,
  RefPointResultCallback,
  RefPointTerminatedCallback,
  RefPointProgressCallback,
} from "./worker-facade";
import { getStore, updateStore } from "@/store/store";
import {
  calcNormalizedWorkerIndex,
  findFreeWorkerIndex,
  getWorkerPool,
  iterateAllWorker,
  resetAllWorker,
} from "./pool-instance";
import {
  getRefOrbitCache,
  getRefOrbitCacheIfAvailable,
  setRefOrbitCache,
} from "./reference-orbit-cache";
import {
  addJob,
  clearTaskQueue,
  countRunningJobs,
  countWaitingJobs,
  getRunningJobsInBatch,
  getRunningJobs,
  getWaitingJobs,
  hasRunningJob,
  hasWaitingJob,
  removeBatchFromRunningJobs,
  removeBatchFromWaitingJobs,
  completeJob,
  startJob,
  canQueueJob,
  markDoneJob,
  popWaitingExecutableJob,
  deleteCompletedDoneJobs,
} from "./task-queue";
import {
  onCalcIterationWorkerIntermediateResult,
  onCalcIterationWorkerProgress,
  onCalcIterationWorkerResult,
} from "./callbacks/iteration-worker";

type JobId = string;
type BatchId = string;

const runningWorkerFacadeMap = new Map<JobId, MandelbrotFacadeLike>();
const batchContextMap = new Map<BatchId, BatchContext>();
const acceptingBatchIds = new Set<BatchId>();

const getLatestBatchContext = () => {
  if (batchContextMap.size === 0) return null;

  const batchIds = Array.from(batchContextMap.keys());
  let batchContext = batchContextMap.get(batchIds[0])!;

  for (const batchId of batchIds) {
    const next = batchContextMap.get(batchId)!;
    if (batchContext.startedAt < next.startedAt) {
      batchContext = next;
    }
  }

  return batchContext;
};

/**
 * BatchContextを取得する
 */
export const getBatchContext = (batchId: string) =>
  batchContextMap.get(batchId);

export const getProgressData = (): string | ResultSpans => {
  const batchContext = getLatestBatchContext();

  if (!batchContext) {
    return "";
  }

  if (batchContext.finishedAt) {
    return {
      total: Math.floor(batchContext.finishedAt - batchContext.startedAt),
      spans: batchContext.spans,
    };
  }

  const { progressMap, mandelbrotParams, refProgress } = batchContext;

  if (refProgress !== mandelbrotParams.N && refProgress !== -1) {
    return `Calculate reference orbit... ${refProgress} / ${mandelbrotParams.N}`;
  }

  const progressList = Array.from(progressMap.values());
  const progress =
    progressList.reduce((a, b) => a + b, 0) / progressList.length;

  return `Generating... ${Math.floor(progress * 100)}%`;
};

const onCalcReferencePointWorkerTerminated: RefPointTerminatedCallback = (
  job,
) => {
  // ここで何をする予定だったんだっけ...
  // terminateされているということは外部からcancelされており、後始末はそっちで行われるはず
};

const onCalcReferencePointWorkerProgress: RefPointProgressCallback = (
  { progress },
  job,
) => {
  const batchContext = batchContextMap.get(job.batchId);

  // 停止が間に合わなかったケースや既にcancelされているケース。何もしない
  if (batchContext == null) {
    return;
  }

  batchContext.refProgress = progress;
};

const onCalcReferencePointWorkerResult: RefPointResultCallback = (
  result,
  job,
) => {
  const { xn, blaTable, elapsed } = result;
  const batchContext = batchContextMap.get(job.batchId);

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
  runningWorkerFacadeMap.delete(job.id);

  tick();
};

export const getWorkerCount = (jobType: JobType): number => {
  return getWorkerPool(jobType).length;
};

export const cycleWorkerType = (): MandelbrotWorkerType => {
  const currentMode = getStore("mode");

  const currentIndex = mandelbrotWorkerTypes.findIndex(
    (v) => v === currentMode,
  );

  const nextMode =
    mandelbrotWorkerTypes[(currentIndex + 1) % mandelbrotWorkerTypes.length];

  return nextMode;
};

/**
 * 指定した数になるまでWorkerPoolを埋める
 */
function fillCalcIterationWorkerPool(
  upTo: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  let fillCount = 0;
  const pool = getWorkerPool("calc-iteration");

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const workerFacade = new CalcIterationWorker(workerType);

    workerFacade.onResult((...args) => {
      onCalcIterationWorkerResult(...args);
      tick();
    });
    workerFacade.onIntermediateResult(onCalcIterationWorkerIntermediateResult);
    workerFacade.onProgress(onCalcIterationWorkerProgress);

    pool.push(workerFacade);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `Iteration Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}

function fillCalcReferencePointWorkerPool(
  upTo: number = 1,
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  if (workerType !== "perturbation") return;

  let fillCount = 0;
  const pool = getWorkerPool("calc-reference-point");

  for (let i = 0; pool.length < upTo && i < upTo; i++) {
    const worker = new CalcReferencePointWorker();

    worker.init();
    worker.onResult(onCalcReferencePointWorkerResult);
    worker.onTerminate(onCalcReferencePointWorkerTerminated);
    worker.onProgress(onCalcReferencePointWorkerProgress);

    pool.push(worker);

    fillCount++;
  }

  if (fillCount > 0) {
    console.info(
      `RefPoint Worker filled: fill count = ${fillCount}, pool size = ${pool.length}`,
    );
  }
}

/**
 * WorkerPoolを再構築する
 * countやworkerTypeが変わった場合に呼ばれる
 */
export function prepareWorkerPool(
  count: number = getStore("workerCount"),
  workerType: MandelbrotWorkerType = getStore("mode"),
) {
  console.debug(`prepareWorkerPool: ${count}, ${workerType}`);

  updateStore("mode", workerType);
  if (workerType === "normal") {
    updateStore("shouldReuseRefOrbit", false);
  }

  resetWorkers();

  fillCalcIterationWorkerPool(count, workerType);
  fillCalcReferencePointWorkerPool(1 /* 仮 */, workerType);
}

/**
 * WorkerPoolを溜まっていたJobごと全部リセットする
 */
export function resetWorkers() {
  iterateAllWorker((workerFacade) => {
    workerFacade.clearCallbacks();
    workerFacade.terminate();
  });
  resetAllWorker();

  clearTaskQueue();

  runningWorkerFacadeMap.clear();
  batchContextMap.clear();
}

export function registerBatch(
  batchId: BatchId,
  units: MandelbrotRenderingUnit[],
  batchContext: Omit<BatchContext, InitialOmittedBatchContextKeys>,
) {
  console.info("registerBatch", { batchId, unitLength: units.length });

  if (!acceptingBatchIds.has(batchId)) {
    console.warn("Denied: already cancelled. batchId =", batchId);
    return;
  }

  const progressMap = new Map<string, number>();

  const refPointJobId = crypto.randomUUID();
  let refX = batchContext.mandelbrotParams.x.toString();
  let refY = batchContext.mandelbrotParams.y.toString();

  // 再利用フラグが立っているなら問答無用でcacheを使い、そうでない場合は使える場合のみ使う
  const refOrbitCache = batchContext.shouldReuseRefOrbit
    ? getRefOrbitCache()
    : getRefOrbitCacheIfAvailable(batchContext.mandelbrotParams);

  if (refOrbitCache) {
    console.debug("Cache available. Using reference orbit cache");

    batchContext.xn = refOrbitCache.xn;
    batchContext.blaTable = refOrbitCache.blaTable;
    refX = refOrbitCache.x.toString();
    refY = refOrbitCache.y.toString();

    markDoneJob(refPointJobId);
  } else if (batchContext.mandelbrotParams.mode === "normal") {
    // normalモードの場合はreference pointの計算は不要
    markDoneJob(refPointJobId);
  } else {
    addJob({
      type: "calc-reference-point",
      id: refPointJobId,
      requiredJobIds: [],
      batchId,
      mandelbrotParams: batchContext.mandelbrotParams,
    } satisfies CalcReferencePointJob);
  }

  for (const unit of units) {
    const job = {
      type: "calc-iteration",
      ...unit,
      id: crypto.randomUUID(),
      requiredJobIds: [refPointJobId],
      batchId,
    } satisfies CalcIterationJob;

    addJob(job);
    progressMap.set(job.id, 0);
  }

  batchContextMap.set(batchId, {
    ...batchContext,
    refX,
    refY,
    progressMap,
    startedAt: performance.now(),
    refProgress: -1,
    spans: [],
  });

  tick();
}

function tick() {
  const refPool = getWorkerPool("calc-reference-point");
  if (
    (refPool.length > 0 &&
      findFreeWorkerIndex("calc-reference-point") === -1) ||
    findFreeWorkerIndex("calc-iteration") === -1
  ) {
    // まだ準備ができていないworkerがいる場合は待つ
    setTimeout(tick, 100);
    return;
  }

  // reference point jobがある場合はpoolに空きがある限り処理を開始する
  while (canQueueJob("calc-reference-point", refPool)) {
    const job = popWaitingExecutableJob("calc-reference-point")!;
    const workerIdx = findFreeWorkerIndex("calc-reference-point");

    // 空いているworkerが見つからなかったのでqueueに戻す
    if (!refPool[workerIdx]) {
      console.error("All workers are currently busy: ", {
        refPoolLength: refPool.length,
        waitingJobs: getWaitingJobs(),
        runningJobs: getRunningJobs(),
        job,
      });
      addJob(job);

      break;
    }

    start(workerIdx, job);
  }

  // requiresが空のもの、もしくはrequiresがdoneJobIdsと一致しているものを処理する
  const iterPool = getWorkerPool("calc-iteration");

  while (canQueueJob("calc-iteration", iterPool)) {
    const job = popWaitingExecutableJob("calc-iteration")!;
    const workerIdx = findFreeWorkerIndex("calc-iteration");

    // 空いているworkerが見つからなかったのでqueueに戻す
    if (!iterPool[workerIdx]) {
      console.error("All workers are currently busy: ", {
        iterPoolLength: iterPool.length,
        waitingJobs: getWaitingJobs(),
        runningJobs: getRunningJobs(),
        job,
      });
      addJob(job);

      break;
    }

    start(workerIdx, job);

    deleteCompletedDoneJobs();
  }

  if (hasWaitingJob() || !hasRunningJob()) {
    console.debug(
      `Job status: running: ${countRunningJobs()}, waiting: ${countWaitingJobs()}`,
    );
  }
}

/**
 * 指定したworkerを使ってjobを開始する
 */
function start(workerIdx: number, job: MandelbrotJob) {
  const batchContext = batchContextMap.get(job.batchId)!;

  const workerIdxForTerminate = calcNormalizedWorkerIndex(job.type, workerIdx);

  const assignedJob = { ...job, workerIdx: workerIdxForTerminate };
  const workerFacade = getWorkerPool(assignedJob.type)[workerIdx];

  workerFacade.startCalculate(assignedJob, batchContext, workerIdxForTerminate);
  startJob(assignedJob);
  runningWorkerFacadeMap.set(assignedJob.id, workerFacade);
}

export function startBatch(batchId: BatchId) {
  acceptingBatchIds.add(batchId);
}

/**
 * 指定したバッチIDのジョブをキャンセルする
 */
export function cancelBatch(batchId: string) {
  acceptingBatchIds.delete(batchId);

  // 待ちリストからは単純に削除
  removeBatchFromWaitingJobs(batchId);

  const runningJobsInBatch = getRunningJobsInBatch(batchId);

  console.info("cancelBatch", {
    batchId,
    runningJobsInBatch,
    runningJobs: getRunningJobs(),
  });

  const batchContext = batchContextMap.get(batchId)!;

  runningJobsInBatch.forEach((job) => {
    const facade = runningWorkerFacadeMap.get(job.id);
    runningWorkerFacadeMap.delete(job.id);

    if (facade == null) return;

    facade.cancel(batchContext, job);
  });

  batchContext?.onComplete(0);

  removeBatchFromRunningJobs(batchId);
  batchContextMap.delete(batchId);

  tick();
}
