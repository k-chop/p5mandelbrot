import { MandelbrotWorkerType, mandelbrotWorkerTypes } from "./types";
import MandelbrotWorker from "./workers/mandelbrot-worker?worker&inline";
import MandelbrotDoubleJsWorker from "./workers/mandelbrot-doublejs-worker?worker&inline";
import MandelbrotSimplePerturbationWorker from "./workers/mandelbrot-simple-perturbation-worker?worker&inline";
import CalcReferencePointWorker from "./workers/calc-reference-point?worker&inline";
import { Rect } from "./rect";

// 処理領域の分割しやすさの関係でワーカーの数は1または偶数に制限しておく
const DEFAULT_WORKER_COUNT = 16;

const _workers: Worker[] = [];
let _currentWorkerType: MandelbrotWorkerType = "normal";
let _workerCount = DEFAULT_WORKER_COUNT;
let _activeWorkerCount = _workers.length;

export const workerPaths: Record<MandelbrotWorkerType, new () => Worker> = {
  normal: MandelbrotWorker,
  doublejs: MandelbrotDoubleJsWorker,
  simplePerturbation: MandelbrotSimplePerturbationWorker,
};

export const currentWorkerType = (): MandelbrotWorkerType => _currentWorkerType;

export const cycleWorkerType = (): MandelbrotWorkerType => {
  const currentIndex = mandelbrotWorkerTypes.findIndex(
    (v) => v === _currentWorkerType
  );
  _currentWorkerType =
    mandelbrotWorkerTypes[(currentIndex + 1) % mandelbrotWorkerTypes.length];

  resetWorkers();
  return _currentWorkerType;
};

export const setWorkerType = (type: MandelbrotWorkerType): void => {
  _currentWorkerType = type;
  resetWorkers();
};

export const getWorkerCount = (): number => _workerCount;

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

export const referencePointWorker = () => new CalcReferencePointWorker();
