import {
  BatchContext,
  CalcIterationJob,
  CalcReferencePointJob,
  MandelbrotJob,
  MandelbrotWorkerType,
  ReferencePointProgress,
  ReferencePointResult,
  WorkerIntermediateResult,
  WorkerProgress,
  WorkerResult,
} from "@/types";
import { referencePointWorkerPath, workerPaths } from "@/workers";
import { ReferencePointContext } from "@/workers/calc-reference-point";

export type RefPointResultCallback = (
  result: ReferencePointContext,
  job: CalcReferencePointJob,
) => void;
export type RefPointProgressCallback = (
  result: ReferencePointProgress,
  job: CalcReferencePointJob,
) => void;
export type RefPointTerminatedCallback = (job: CalcReferencePointJob) => void;
export type WorkerResultCallback = (
  result: WorkerResult,
  job: CalcIterationJob,
) => void;
export type WorkerIntermediateResultCallback = (
  result: WorkerIntermediateResult,
  job: CalcIterationJob,
) => void;
export type WorkerProgressCallback = (
  progress: WorkerProgress,
  job: CalcIterationJob,
) => void;
export type BatchCompleteCallback = (elapsed: number) => void;
export type BatchProgressChangedCallback = (progressStr: string) => void;

export interface MandelbrotFacadeLike {
  startCalculate(
    job: MandelbrotJob,
    batchContext: BatchContext,
    workerIdx: number,
  ): void;

  terminate(callback?: () => void): void;
  terminateAsync(): Promise<void>;

  init(): Promise<void>;

  cancel(batchContext: BatchContext, job: MandelbrotJob): void;

  isRunning(): boolean;
  isReady(): boolean;
}

export class CalcIterationWorker implements MandelbrotFacadeLike {
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

  isReady = () => true;

  init = async () => {};

  startCalculate = (
    job: CalcIterationJob,
    batchContext: BatchContext,
    workerIdx: number,
  ) => {
    this.running = true;

    const f = (
      ev: MessageEvent<
        WorkerResult | WorkerIntermediateResult | WorkerProgress
      >,
    ) => {
      const data = ev.data;

      switch (data.type) {
        case "result": {
          const { iterations, elapsed } = data;

          const iterationsResult = new Uint32Array(iterations);

          this.resultCallback?.(
            { type: "result", iterations: iterationsResult, elapsed },
            job,
          );

          this.worker.removeEventListener("message", f);
          this.running = false;
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

    const { rect, id } = job;
    const {
      pixelHeight,
      pixelWidth,
      xn,
      blaTable,
      refX,
      refY,
      terminator,
      mandelbrotParams,
    } = batchContext;

    this.worker.addEventListener("message", f);

    const t = new Uint8Array(terminator);
    Atomics.store(t, workerIdx, 0);

    this.worker.postMessage({
      type: "calc",
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
      jobId: id,
      terminator,
      workerIdx,
    });
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

  cancel = ({ terminator }: BatchContext, { workerIdx }: MandelbrotJob) => {
    if (workerIdx == null) {
      return;
    }

    const t = new Uint8Array(terminator);
    Atomics.store(t, workerIdx, 1);
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

export class CalcReferencePointWorker implements MandelbrotFacadeLike {
  worker: Worker;
  running = false;
  inited = false;

  resultCallback?: RefPointResultCallback;
  progressCallback?: RefPointProgressCallback;
  terminatedCallback?: RefPointTerminatedCallback;

  constructor() {
    this.worker = new referencePointWorkerPath();
  }

  isRunning = () => {
    return this.running;
  };

  isReady = () => this.inited;

  init = async () => {
    await new Promise<void>((resolve) => {
      const initializeHandler = (event: MessageEvent) => {
        if (event?.data?.type === "init") {
          this.inited = true;
          resolve();
          this.worker.removeEventListener("message", initializeHandler);
        } else {
          console.error("Receive message before init", event.data);
        }
      };

      this.worker.addEventListener("message", initializeHandler);
    });
  };

  startCalculate = (
    job: CalcReferencePointJob,
    batchContext: BatchContext,
    workerIdx: number,
  ) => {
    this.running = true;

    const complexCenterX = batchContext.mandelbrotParams.x.toString();
    const complexCenterY = batchContext.mandelbrotParams.y.toString();
    const complexRadius = batchContext.mandelbrotParams.r.toString();
    const maxIteration = batchContext.mandelbrotParams.N;
    const pixelHeight = batchContext.pixelHeight;
    const pixelWidth = batchContext.pixelWidth;

    const handler = (
      ev: MessageEvent<ReferencePointResult | ReferencePointProgress>,
    ) => {
      const { type } = ev.data;
      if (type === "terminated") {
        this.worker.removeEventListener("message", handler);
        this.running = false;

        this.terminatedCallback?.(job);
      }
      if (type === "result") {
        this.worker.removeEventListener("message", handler);
        this.running = false;

        const { xn, blaTable, elapsed } = ev.data;
        this.resultCallback?.({ xn, blaTable, elapsed }, job);
      }
      if (type === "progress") {
        const { progress } = ev.data;
        this.progressCallback?.({ type: "progress", progress }, job);
      }
    };

    this.worker.addEventListener("message", handler);

    const { terminator } = batchContext;
    const { id: jobId } = job;

    const t = new Uint8Array(terminator);
    Atomics.store(t, workerIdx, 0);

    this.worker.postMessage({
      complexCenterX,
      complexCenterY,
      pixelWidth,
      pixelHeight,
      complexRadius,
      maxIteration,
      jobId,
      terminator,
      workerIdx,
    });
  };

  terminate = (callback?: () => void) => {
    this.worker.terminate();
    callback?.();
    this.running = false;
  };

  terminateAsync = () => {
    this.worker.terminate();

    this.running = false;
    return Promise.resolve();
  };

  cancel = ({ terminator }: BatchContext, { workerIdx }: MandelbrotJob) => {
    if (workerIdx == null) {
      return;
    }

    const t = new Uint8Array(terminator);
    Atomics.store(t, workerIdx, 1);
  };

  onResult = (callback: RefPointResultCallback) => {
    this.resultCallback = callback;
  };

  onProgress = (callback: RefPointProgressCallback) => {
    this.progressCallback = callback;
  };

  onTerminate = (callback: RefPointTerminatedCallback) => {
    this.terminatedCallback = callback;
  };

  clearCallbacks = () => {
    this.resultCallback = undefined;
    this.terminatedCallback = undefined;
    this.progressCallback = undefined;
  };
}
