import { MandelbrotWorkerType } from "./types";
import MandelbrotWorker from "./mandelbrot-worker?worker&inline";
import MandelbrotDoubleJsWorker from "./mandelbrot-doublejs-worker?worker&inline";
import { Rect } from "./rect";

const DEFAULT_WORKER_COUNT = 16;

const _workers: Worker[] = [];
let _currentWorkerType: MandelbrotWorkerType = "normal";
let _workerCount = DEFAULT_WORKER_COUNT;
let _activeWorkerCount = _workers.length;

export const workerPaths: Record<MandelbrotWorkerType, new () => Worker> = {
  normal: MandelbrotWorker,
  doublejs: MandelbrotDoubleJsWorker,
};

export const currentWorkerType = (): MandelbrotWorkerType => _currentWorkerType;

export const toggleWorkerType = (): void => {
  _currentWorkerType = _currentWorkerType === "normal" ? "doublejs" : "normal";
  resetWorkers();
};

export const workersLength = (): number => _workers.length;

export const activeWorkerCount = (): number => _activeWorkerCount;

export const resetWorkers = (): void => {
  _workers.forEach((worker) => worker.terminate());
  _workers.splice(0);

  for (let i = 0; i < _workerCount; i++) {
    const workerConstructor = workerPaths[_currentWorkerType];
    _workers.push(new workerConstructor());
  }
};

export const terminateWorkers = (): void => {
  _workers.forEach((worker) => worker.terminate());
  resetWorkers();
};

export const registerWorkerTask = (
  calculationRects: Rect[],
  f: (
    worker: Worker,
    rect: Rect,
    idx: number,
    workers: Worker[],
    isCompleted: (completed: number) => boolean
  ) => void
): void => {
  _activeWorkerCount = calculationRects.length;

  for (let i = 0; i < calculationRects.length; i++) {
    const rect = calculationRects[i];
    const worker = _workers[i];

    f(
      worker,
      rect,
      i,
      _workers,
      (completed) => completed >= calculationRects.length
    );
  }
};
