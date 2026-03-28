import type {
  InterestingPoint,
  InterestingPointsDebugData,
} from "@/interesting-points/find-interesting-points";
import InterestingPointsWorker from "@/workers/interesting-points-worker?worker&inline";
import type {
  InterestingPointsComputeRequest,
  InterestingPointsComputeResponse,
} from "@/workers/interesting-points-worker-protocol";

/** 計算結果の型 */
export interface InterestingPointsResult {
  points: InterestingPoint[];
  debugData: InterestingPointsDebugData | null;
}

let worker: Worker | null = null;
let currentRequestId = 0;
let pendingResolve: ((result: InterestingPointsResult | null) => void) | null = null;

/**
 * Workerインスタンスを取得する（遅延生成）
 */
const getWorker = (): Worker => {
  if (worker === null) {
    worker = new InterestingPointsWorker();
    worker.addEventListener("message", (event: MessageEvent<InterestingPointsComputeResponse>) => {
      const { requestId, points, debugData } = event.data;
      // 古いリクエストの結果は無視する
      if (requestId !== currentRequestId) return;
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve({ points, debugData });
      }
    });
  }
  return worker;
};

/**
 * 興味深いポイントをWeb Workerで非同期に計算する。
 * 前回のリクエストが未完了の場合、その結果は自動的に破棄される。
 * bufferはtransferされるため、呼び出し後は使用不可になる。
 */
export const computeInterestingPointsAsync = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: { debug?: boolean },
): Promise<InterestingPointsResult | null> => {
  // 前回の未完了リクエストをキャンセル
  if (pendingResolve) {
    pendingResolve(null);
    pendingResolve = null;
  }

  currentRequestId++;
  const requestId = currentRequestId;

  const message: InterestingPointsComputeRequest = {
    type: "compute",
    requestId,
    buffer: buffer.buffer as ArrayBuffer,
    width,
    height,
    maxIteration,
    debug: options?.debug ?? false,
  };

  getWorker().postMessage(message, [buffer.buffer as ArrayBuffer]);

  return new Promise<InterestingPointsResult | null>((resolve) => {
    pendingResolve = resolve;
  });
};

/**
 * 進行中の計算をキャンセルする。結果は破棄される。
 */
export const cancelInterestingPointsComputation = (): void => {
  if (pendingResolve) {
    pendingResolve(null);
    pendingResolve = null;
  }
  currentRequestId++;
};
