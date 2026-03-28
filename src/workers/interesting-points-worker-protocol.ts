import type {
  InterestingPoint,
  InterestingPointsDebugData,
} from "@/interesting-points/find-interesting-points";

/** メインスレッド → Worker へのリクエスト */
export interface InterestingPointsComputeRequest {
  type: "compute";
  requestId: number;
  /** iteration bufferのArrayBuffer（transferで渡される） */
  buffer: ArrayBuffer;
  width: number;
  height: number;
  maxIteration: number;
  debug: boolean;
}

/** Worker → メインスレッドへのレスポンス */
export interface InterestingPointsComputeResponse {
  type: "result";
  requestId: number;
  points: InterestingPoint[];
  debugData: InterestingPointsDebugData | null;
}
