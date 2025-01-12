import { BigNumber } from "bignumber.js";
import { Rect } from "./math/rect";
import type { Resolution } from "./rendering/rendering";
import {
  BatchCompleteCallback,
  BatchProgressChangedCallback,
} from "./worker-pool/worker-facade";

// FIXME: このファイルは破壊しろ

export interface IterationIntermediateResult {
  type: "intermediateResult";
  iterations: ArrayBuffer;
  resolution: Resolution;
}

export interface IterationProgress {
  type: "progress";
  progress: number;
}

export interface RefOrbitResult {
  type: "result" | "terminated";
  xn: XnBuffer;
  blaTable: BLATableBuffer;
  elapsed: number;
}

export interface RefOrbitProgress {
  type: "progress";
  progress: number;
}

export interface RefOrbitShutdown {
  type: "shutdown";
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
  serializedPalette?: string;
}

export interface IterationWorkerParams {
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

export interface RefOrbitWorkerParams {
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

export type MandelbrotJob = CalcIterationJob | CalcRefOrbitJob;

export interface MandelbrotJobBase {
  id: string;
  batchId: string;
  // jobが実際に走るタイミングで設定される
  workerIdx?: number;
  requiredJobIds: string[];
}

export interface CalcIterationJob
  extends MandelbrotJobBase,
    MandelbrotRenderingUnit {
  type: "calc-iteration";
}

export interface CalcRefOrbitJob extends MandelbrotJobBase {
  type: "calc-ref-orbit";
  mandelbrotParams: MandelbrotParams;
}

export interface Span {
  name: string;
  elapsed: number;
}

export interface ResultSpans {
  total: number;
  spans: Span[];
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
  shouldReuseRefOrbit: boolean;

  progressMap: Map<string, number>;
  refProgress: number;
  startedAt: number;
  finishedAt?: number;
  spans: Span[];
}

export type InitialOmittedBatchContextKeys =
  | "refX"
  | "refY"
  | "progressMap"
  | "startedAt"
  | "refProgress"
  | "spans";

export type JobType = "calc-iteration" | "calc-ref-orbit";

export type RefOrbitCache = {
  x: BigNumber;
  y: BigNumber;
  r: BigNumber; // 縮小時は100%再利用して良いのでその判断のために必要
  N: number;
  xn: XnBuffer;
  blaTable: BLATableBuffer;
};
