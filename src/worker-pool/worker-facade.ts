import {
  BatchContext,
  CalcIterationJob,
  CalcRefOrbitJob,
  IterationIntermediateResult,
  IterationProgress,
  IterationResult,
  MandelbrotJob,
  MandelbrotWorkerType,
  RefOrbitProgress,
  RefOrbitResult,
  type RefOrbitShutdown,
} from "@/types";
import { refOrbitWorkerPath, workerPaths } from "@/workers";
import { RefOrbitContext } from "@/workers/calc-ref-orbit";

export type RefOrbitResultCallback = (
  result: RefOrbitContext,
  job: CalcRefOrbitJob,
) => void;
export type RefOrbitProgressCallback = (
  result: RefOrbitProgress,
  job: CalcRefOrbitJob,
) => void;
export type RefOrbitTerminatedCallback = (job: CalcRefOrbitJob) => void;
export type IterationResultCallback = (
  result: IterationResult,
  job: CalcIterationJob,
) => void;
export type IterationIntermediateResultCallback = (
  result: IterationIntermediateResult,
  job: CalcIterationJob,
) => void;
export type IterationProgressCallback = (
  progress: IterationProgress,
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
  clearCallbacks(): void;

  isRunning(): boolean;
  isReady(): boolean;
}

export class CalcIterationWorker implements MandelbrotFacadeLike {
  worker: Worker;
  running = false;

  resultCallback?: IterationResultCallback;
  intermediateResultCallback?: IterationIntermediateResultCallback;
  progressCallback?: IterationProgressCallback;

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
        IterationResult | IterationIntermediateResult | IterationProgress
      >,
    ) => {
      const data = ev.data;

      switch (data.type) {
        case "result": {
          const { iterations, elapsed } = data;

          this.resultCallback?.({ type: "result", iterations, elapsed }, job);

          this.worker.removeEventListener("message", f);
          this.running = false;
          break;
        }
        case "intermediateResult": {
          const { iterations, resolution } = data;
          this.intermediateResultCallback?.(
            {
              type: "intermediateResult",
              iterations: iterations,
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

  onResult = (callback: IterationResultCallback) => {
    this.resultCallback = callback;
  };

  onIntermediateResult = (callback: IterationIntermediateResultCallback) => {
    this.intermediateResultCallback = callback;
  };

  onProgress = (callback: IterationProgressCallback) => {
    this.progressCallback = callback;
  };

  clearCallbacks = () => {
    this.resultCallback = undefined;
    this.intermediateResultCallback = undefined;
    this.progressCallback = undefined;
  };
}

export class RefOrbitWorker implements MandelbrotFacadeLike {
  worker: Worker;
  running = false;
  inited = false;

  resultCallback?: RefOrbitResultCallback;
  progressCallback?: RefOrbitProgressCallback;
  terminatedCallback?: RefOrbitTerminatedCallback;

  constructor() {
    this.worker = new refOrbitWorkerPath();
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
    job: CalcRefOrbitJob,
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

    const handler = (ev: MessageEvent<RefOrbitResult | RefOrbitProgress>) => {
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
      type: "calc-reference-orbit",
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
    const promise = new Promise<void>((resolve) => {
      const handler = (ev: MessageEvent<RefOrbitShutdown>) => {
        if (ev.data.type === "shutdown") {
          this.worker.terminate();
          this.running = false;
          this.worker.removeEventListener("message", handler);
          resolve();
        }
      };

      this.worker.addEventListener("message", handler);

      this.worker.postMessage({ type: "request-shutdown" });
    });

    return promise;
  };

  cancel = ({ terminator }: BatchContext, { workerIdx }: MandelbrotJob) => {
    if (workerIdx == null) {
      return;
    }

    const t = new Uint8Array(terminator);
    Atomics.store(t, workerIdx, 1);
  };

  onResult = (callback: RefOrbitResultCallback) => {
    this.resultCallback = callback;
  };

  onProgress = (callback: RefOrbitProgressCallback) => {
    this.progressCallback = callback;
  };

  onTerminate = (callback: RefOrbitTerminatedCallback) => {
    this.terminatedCallback = callback;
  };

  clearCallbacks = () => {
    this.resultCallback = undefined;
    this.terminatedCallback = undefined;
    this.progressCallback = undefined;
  };
}
