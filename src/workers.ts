import { MandelbrotWorkerType } from "./types";

const WORKER_COUNT = 64;

const _workers: Worker[] = [];
let _currentWorkerType: MandelbrotWorkerType = "normal";

export const workerPaths: Record<MandelbrotWorkerType, URL> = {
  normal: new URL("./mandelbrot-worker.ts", import.meta.url),
  doublejs: new URL("./mandelbrot-doublejs-worker.ts", import.meta.url),
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

  for (let i = 0; i < WORKER_COUNT; i++) {
    const path = workerPaths[_currentWorkerType];
    _workers.push(new Worker(path, { type: "module" }));
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
    f(worker, idx, workers, (completed) => completed === WORKER_COUNT)
  );
};
