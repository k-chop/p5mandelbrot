import {
  BatchContext,
  MandelbrotJob,
  MandelbrotWorkerType,
  WorkerIntermediateResult,
  WorkerProgress,
  WorkerResult,
} from "@/types";
import { workerPaths } from "@/workers";

export type WorkerResultCallback = (
  result: WorkerResult,
  job: MandelbrotJob,
) => void;
export type WorkerIntermediateResultCallback = (
  result: WorkerIntermediateResult,
  job: MandelbrotJob,
) => void;
export type WorkerProgressCallback = (
  progress: WorkerProgress,
  job: MandelbrotJob,
) => void;
export type BatchCompleteCallback = (elapsed: number) => void;
export type BatchProgressChangedCallback = (progressStr: string) => void;

export interface MandelbrotFacadeLike {
  startCalculate(job: MandelbrotJob, batchContext: BatchContext): void;

  terminate(callback?: () => void): void;
  terminateAsync(): Promise<void>;

  onResult(callback: WorkerResultCallback): void;
  onIntermediateResult(callback: WorkerIntermediateResultCallback): void;
  onProgress(callback: WorkerProgressCallback): void;

  clearCallbacks(): void;

  isRunning(): boolean;
}

export class WorkerFacade implements MandelbrotFacadeLike {
  worker: Worker;
  running = false;

  resultCallback?: WorkerResultCallback;
  intermediateResultCallback?: WorkerIntermediateResultCallback;
  progressCallback?: WorkerProgressCallback;

  constructor(workerType: MandelbrotWorkerType) {
    const workerConstructor = workerPaths[workerType];
    this.worker = new workerConstructor();
  }

  isRunning = () => {
    return this.running;
  };

  startCalculate = (job: MandelbrotJob, batchContext: BatchContext) => {
    const f = (
      ev: MessageEvent<
        WorkerResult | WorkerIntermediateResult | WorkerProgress
      >,
    ) => {
      const data = ev.data;

      switch (data.type) {
        case "result": {
          const { iterations } = data;

          const iterationsResult = new Uint32Array(iterations);

          this.running = false;
          this.resultCallback?.(
            { type: "result", iterations: iterationsResult },
            job,
          );

          this.worker.removeEventListener("message", f);
          break;
        }
        case "intermediateResult": {
          const { iterations, resolution } = data;
          this.intermediateResultCallback?.(
            {
              type: "intermediateResult",
              iterations: new Uint32Array(iterations),
              resolution,
            },
            job,
          );
          break;
        }
        case "progress": {
          const { progress } = data;
          this.progressCallback?.({ type: "progress", progress }, job);
          break;
        }
      }
    };

    const { rect, mandelbrotParams } = job;
    const { pixelHeight, pixelWidth, xn, blaTable, refX, refY } = batchContext;

    this.worker.addEventListener("message", f);
    this.worker.postMessage({
      cx: mandelbrotParams.x.toString(),
      cy: mandelbrotParams.y.toString(),
      r: mandelbrotParams.r.toString(),
      N: mandelbrotParams.N,
      pixelHeight,
      pixelWidth,
      startX: rect.x,
      endX: rect.x + rect.width,
      startY: rect.y,
      endY: rect.y + rect.height,
      xn,
      blaTable,
      refX,
      refY,
    });

    this.running = true;
  };

  terminate = (callback?: () => void) => {
    this.worker.terminate();
    this.running = false;
    callback?.();
  };

  terminateAsync = () => {
    this.running = false;
    this.worker.terminate();

    return Promise.resolve();
  };

  onResult = (callback: WorkerResultCallback) => {
    this.resultCallback = callback;
  };

  onIntermediateResult = (callback: WorkerIntermediateResultCallback) => {
    this.intermediateResultCallback = callback;
  };

  onProgress = (callback: WorkerProgressCallback) => {
    this.progressCallback = callback;
  };

  clearCallbacks = () => {
    this.resultCallback = undefined;
    this.intermediateResultCallback = undefined;
    this.progressCallback = undefined;
  };
}
