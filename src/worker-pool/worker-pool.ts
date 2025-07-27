import { removeBatchTrace, startBatchTrace } from "@/event-viewer/event";
import { getStore } from "@/store/store";
import {
  BatchContext,
  CalcIterationJob,
  CalcRefOrbitJob,
  InitialOmittedBatchContextKeys,
  MandelbrotJob,
  MandelbrotRenderingUnit,
  MandelbrotWorkerType,
  ResultSpans,
  mandelbrotWorkerTypes,
} from "@/types";
import { debugWatch } from "@/utils/debug";
import {
  calcNormalizedWorkerIndex,
  findFreeWorkerIndex,
  getWorkerPool,
} from "./pool-instance";
import {
  getRefOrbitCache,
  getRefOrbitCacheIfAvailable,
} from "./ref-orbit-cache";
import {
  addJob,
  canQueueJob,
  countRunningJobs,
  countWaitingJobs,
  deleteCompletedDoneJobs,
  getRunningJobs,
  getRunningJobsInBatch,
  getWaitingJobs,
  hasRunningJob,
  markDoneJob,
  popWaitingExecutableJob,
  removeBatchFromRunningJobs,
  removeBatchFromWaitingJobs,
  startJob,
} from "./task-queue";
import { popWorkerReference, setWorkerReference } from "./worker-reference";

type BatchId = string;

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

export const clearBatchContext = () => {
  batchContextMap.clear();
};

/**
 * Footerで表示するための進捗情報をbatchContextから取得する
 */
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

export const cycleWorkerType = (): MandelbrotWorkerType => {
  const currentMode = getStore("mode");

  const currentIndex = mandelbrotWorkerTypes.findIndex(
    (v) => v === currentMode,
  );

  const nextMode =
    mandelbrotWorkerTypes[(currentIndex + 1) % mandelbrotWorkerTypes.length];

  return nextMode;
};

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

  const refOrbitJobId = crypto.randomUUID();
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

    markDoneJob(refOrbitJobId);
  } else if (batchContext.mandelbrotParams.mode === "normal") {
    // normalモードの場合はreference orbitの計算は不要
    markDoneJob(refOrbitJobId);
  } else {
    addJob({
      type: "calc-ref-orbit",
      id: refOrbitJobId,
      requiredJobIds: [],
      batchId,
      mandelbrotParams: batchContext.mandelbrotParams,
    } satisfies CalcRefOrbitJob);
  }

  for (const unit of units) {
    const job = {
      type: "calc-iteration",
      ...unit,
      id: crypto.randomUUID(),
      requiredJobIds: [refOrbitJobId],
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

  tickWorkerPool();
}

export function tickWorkerPool() {
  let jobStarted = false;
  const refPool = getWorkerPool("calc-ref-orbit");
  if (
    (refPool.length > 0 && findFreeWorkerIndex("calc-ref-orbit") === -1) ||
    findFreeWorkerIndex("calc-iteration") === -1
  ) {
    // まだ準備ができていないworkerがいる場合は待つ
    setTimeout(tickWorkerPool, 100);
    return;
  }

  // reference orbit jobがある場合はpoolに空きがある限り処理を開始する
  while (canQueueJob("calc-ref-orbit", refPool)) {
    const job = popWaitingExecutableJob("calc-ref-orbit")!;
    const workerIdx = findFreeWorkerIndex("calc-ref-orbit");

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

    jobStarted = true;
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

    jobStarted = true;
    start(workerIdx, job);

    deleteCompletedDoneJobs();
  }

  if (jobStarted || !hasRunningJob()) {
    debugWatch(
      "jobStatus",
      `running: ${countRunningJobs()}, waiting: ${countWaitingJobs()}`,
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
  setWorkerReference(assignedJob.id, workerFacade);
}

export function startBatch(batchId: BatchId) {
  acceptingBatchIds.add(batchId);
  startBatchTrace(batchId);
}

/**
 * 指定したバッチIDのジョブをキャンセルする
 */
export function cancelBatch(batchId: string) {
  acceptingBatchIds.delete(batchId);
  removeBatchTrace(batchId);

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
    const facade = popWorkerReference(job.id);

    if (facade == null) return;

    facade.cancel(batchContext, job);
  });

  batchContext?.onComplete(0);

  removeBatchFromRunningJobs(batchId);
  batchContextMap.delete(batchId);

  tickWorkerPool();
}
