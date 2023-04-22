import { BigNumber } from "bignumber.js";
import { Rect } from "./rect";

export interface WorkerResult {
  type: "result";
  iterations: ArrayBuffer;
}

export interface WorkerProgress {
  type: "progress";
  progress: number;
}

export interface OffsetParams {
  x: number;
  y: number;
}

export interface MandelbrotParams {
  x: BigNumber;
  y: BigNumber;
  r: BigNumber;
  N: number;
  R: number;
  mode: MandelbrotWorkerType;
}

export interface WorkerParams {
  row: number;
  col: number;
  cx: string;
  cy: string;
  r: string;
  R2: number;
  N: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

export const mandelbrotWorkerTypes = [
  "normal",
  "doublejs",
  "simplePerturbation",
] as const;
export type MandelbrotWorkerType = typeof mandelbrotWorkerTypes[number];

export interface IterationBuffer {
  rect: Rect;
  buffer: Uint32Array;
}
