import {
  MandelbrotWorkerType,
  ReferencePointCalculationWorkerParams,
  ReferencePointResult,
  mandelbrotWorkerTypes,
} from "./types";
import MandelbrotWorker from "./workers/mandelbrot-worker?worker&inline";
import MandelbrotPerturbationWorker from "./workers/mandelbrot-perturbation-worker?worker&inline";
import CalcReferencePointWorker from "./workers/calc-reference-point?worker&inline";
import { Rect } from "./rect";
import { getStore } from "./store/store";
import { ReferencePointContext } from "./workers/calc-reference-point";

// 処理領域の分割しやすさの関係でワーカーの数は1または偶数に制限しておく
const DEFAULT_WORKER_COUNT = 16;

const _workers: Worker[] = [];
let _currentWorkerType: MandelbrotWorkerType = "normal";
let _workerCount = DEFAULT_WORKER_COUNT;
let _activeWorkerCount = _workers.length;
let _referencePointWorker: Worker;

export const workerPaths: Record<MandelbrotWorkerType, new () => Worker> = {
  normal: MandelbrotWorker,
  perturbation: MandelbrotPerturbationWorker,
};

export const currentWorkerType = (): MandelbrotWorkerType => _currentWorkerType;

export const cycleWorkerType = (): MandelbrotWorkerType => {
  const currentIndex = mandelbrotWorkerTypes.findIndex(
    (v) => v === _currentWorkerType,
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

export const setWorkerCount = (
  count: number = getStore("workerCount"),
): void => {
  _workerCount = count;
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
    isCompleted: (completed: number) => boolean,
  ) => void,
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
      (completed) => completed >= calculationRects.length,
    );
  }
};

export async function referencePointWorker() {
  if (_referencePointWorker) {
    return _referencePointWorker;
  }

  _referencePointWorker = await initReferencePointWorker();
  return _referencePointWorker;
}

export async function initReferencePointWorker(): Promise<Worker> {
  const refWorker = new CalcReferencePointWorker();

  await new Promise<void>((resolve) => {
    const initializeHandler = (event: MessageEvent) => {
      if (event?.data?.type === "init") {
        resolve();
        refWorker.removeEventListener("message", initializeHandler);
      } else {
        console.error("Receive message before init", event.data);
      }
    };

    refWorker.addEventListener("message", initializeHandler);
  });

  return refWorker;
}

export async function calcReferencePointWithWorker(
  params: ReferencePointCalculationWorkerParams,
): Promise<ReferencePointContext> {
  const refWorker = await referencePointWorker();

  const promise = new Promise<ReferencePointContext>((resolve) => {
    const handler = (ev: MessageEvent<ReferencePointResult>) => {
      const { type, xn, blaTable } = ev.data;
      if (type === "result") {
        resolve({ xn, blaTable });
        refWorker.removeEventListener("message", handler);
      }
    };

    refWorker.addEventListener("message", handler);
    refWorker.postMessage({
      complexCenterX: params.complexCenterX,
      complexCenterY: params.complexCenterY,
      pixelWidth: params.pixelWidth,
      pixelHeight: params.pixelHeight,
      complexRadius: params.complexRadius,
      maxIteration: params.maxIteration,
    });
  });

  return promise;
}
