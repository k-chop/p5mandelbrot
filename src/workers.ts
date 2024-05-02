import { MandelbrotWorkerType } from "./types";
import MandelbrotWorker from "./workers/mandelbrot-worker?worker&inline";
import MandelbrotPerturbationWorker from "./workers/mandelbrot-perturbation-worker?worker&inline";
import CalcReferencePointWorker from "./workers/calc-reference-point?worker&inline";

export const workerPaths: Record<MandelbrotWorkerType, new () => Worker> = {
  normal: MandelbrotWorker,
  perturbation: MandelbrotPerturbationWorker,
};

export const referencePointWorkerPath = CalcReferencePointWorker;
