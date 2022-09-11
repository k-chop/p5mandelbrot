import { BigNumber } from "bignumber.js";

export interface WorkerResult {
  type: "result";
  pixels: ArrayBuffer;
  iterations: ArrayBuffer;
}

export interface WorkerProgress {
  type: "progress";
  progress: number;
}

export interface MandelbrotParams {
  x: BigNumber;
  y: BigNumber;
  r: BigNumber;
  N: number;
  R: number;
}

export interface WorkerParams {
  row: number;
  col: number;
  cx: string;
  cy: string;
  r: string;
  R2: number;
  N: number;
  start: number;
  end: number;
  palette: Uint8ClampedArray;
}

export type MandelbrotWorkerType = "normal" | "doublejs";
