import { MandelbrotWorkerType } from "./types";
import MandelbrotWorker from "./mandelbrot-worker?worker&inline";
import MandelbrotDoubleJsWorker from "./mandelbrot-doublejs-worker?worker&inline";

const DEFAULT_WORKER_COUNT = 16;

const _workers: Worker[] = [];
let _currentWorkerType: MandelbrotWorkerType = "normal";
let _workerCount = DEFAULT_WORKER_COUNT;

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
  f: (
    worker: Worker,
    idx: number,
    workers: Worker[],
    isCompleted: (completed: number) => boolean
  ) => void
): void => {
  _workers.forEach((worker, idx, workers) =>
    f(worker, idx, workers, (completed) => completed === _workerCount)
  );
};
