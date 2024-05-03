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
  type: "result" | "terminated";
  xn: XnBuffer;
  blaTable: BLATableBuffer;
}

export interface ReferencePointProgress {
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
  jobId: string;
  terminator: SharedArrayBuffer;
  workerIdx: number;
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
  jobId: string;
  terminator: SharedArrayBuffer;
  workerIdx: number;
}

export const mandelbrotWorkerTypes = ["normal", "perturbation"] as const;
export type MandelbrotWorkerType = (typeof mandelbrotWorkerTypes)[number];

export interface IterationBuffer {
  rect: Rect;
  buffer: Uint32Array;
  resolution: Resolution;
}

export interface MandelbrotRenderingUnit {
  rect: Rect;
}

export type MandelbrotJob = CalcIterationJob | CalcReferencePointJob;

export interface MandelbrotJobBase {
  id: string;
  batchId: string;
  // jobが実際に走るタイミングで設定される
  workerIdx?: number;
}

export interface CalcIterationJob
  extends MandelbrotJobBase,
    MandelbrotRenderingUnit {
  type: "calc-iteration";
  requiredJobIds: string[];
}

export interface CalcReferencePointJob extends MandelbrotJobBase {
  type: "calc-reference-point";
  mandelbrotParams: MandelbrotParams;
}

export interface BatchContext {
  onComplete: BatchCompleteCallback;
  onChangeProgress: BatchProgressChangedCallback;

  mandelbrotParams: MandelbrotParams;
  refX: string;
  refY: string;
  pixelWidth: number;
  pixelHeight: number;
  xn?: XnBuffer;
  blaTable?: BLATableBuffer;
  terminator: SharedArrayBuffer;

  progressMap: Map<string, number>;
  refProgress: number;
  startedAt: number;
  finishedAt?: number;
}

export type JobType = "calc-iteration" | "calc-reference-point";
