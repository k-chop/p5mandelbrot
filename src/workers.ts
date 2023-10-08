import {
  MandelbrotWorkerType,
  ReferencePointCalculationWorkerParams,
  ReferencePointResult,
} from "./types";
import MandelbrotWorker from "./workers/mandelbrot-worker?worker&inline";
import MandelbrotPerturbationWorker from "./workers/mandelbrot-perturbation-worker?worker&inline";
import CalcReferencePointWorker from "./workers/calc-reference-point?worker&inline";
import { ReferencePointContext } from "./workers/calc-reference-point";

let _referencePointWorker: Worker;

export const workerPaths: Record<MandelbrotWorkerType, new () => Worker> = {
  normal: MandelbrotWorker,
  perturbation: MandelbrotPerturbationWorker,
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
