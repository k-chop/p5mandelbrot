import { BigNumber } from "bignumber.js";
import { Rect } from "./rect";
import { BLATableItem, Complex } from "./math";
import {
  BatchCompleteCallback,
  BatchProgressChangedCallback,
} from "./worker-pool/worker-facade";

export interface Resolution {
  width: number;
  height: number;
}

export interface WorkerResult {
  type: "result";
  iterations: ArrayBuffer;
}

export interface WorkerIntermediateResult {
  type: "intermediateResult";
  iterations: ArrayBuffer;
  resolution: Resolution;
}

export interface WorkerProgress {
  type: "progress";
  progress: number;
}

export interface ReferencePointResult {
  type: "result";
  xn: XnBuffer;
  blaTable: BLATableBuffer;
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
  mode: MandelbrotWorkerType;
}

export interface POIData extends MandelbrotParams {
  id: string; // UUID
}

export interface MandelbrotCalculationWorkerParams {
  pixelHeight: number;
  pixelWidth: number;
  cx: string;
  cy: string;
  r: string;
  N: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  xn: XnBuffer;
  blaTable: BLATableBuffer;
  refX: string;
  refY: string;
}

export type XnBuffer = ArrayBuffer;
export type BLATableBuffer = ArrayBuffer;

export interface ReferencePointCalculationWorkerParams {
  complexCenterX: string;
  complexCenterY: string;
  pixelWidth: number;
  pixelHeight: number;
  complexRadius: string;
  maxIteration: number;
}

export const mandelbrotWorkerTypes = ["normal", "perturbation"] as const;
export type MandelbrotWorkerType = (typeof mandelbrotWorkerTypes)[number];

export interface IterationBuffer {
  rect: Rect;
  buffer: Uint32Array;
  resolution: Resolution;
}

export interface MandelbrotRenderingUnit {
  mandelbrotParams: MandelbrotParams;
  rect: Rect;
}

export interface MandelbrotJob extends MandelbrotRenderingUnit {
  id: string;
  batchId: string;
}

export interface BatchContext {
  onComplete: BatchCompleteCallback;
  onChangeProgress: BatchProgressChangedCallback;

  refX: string;
  refY: string;
  pixelWidth: number;
  pixelHeight: number;
  xn: XnBuffer;
  blaTable: BLATableBuffer;

  progressMap: Map<string, number>;
  startedAt: number;
  finishedAt?: number;
}
