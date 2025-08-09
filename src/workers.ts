import type { MandelbrotWorkerType } from "./types";
import RefOrbitWorker from "./workers/calc-ref-orbit?worker&inline";
import MandelbrotPerturbationWorker from "./workers/mandelbrot-perturbation-worker?worker&inline";
import MandelbrotWorker from "./workers/mandelbrot-worker?worker&inline";

export const workerPaths: Record<MandelbrotWorkerType, new () => Worker> = {
  normal: MandelbrotWorker,
  perturbation: MandelbrotPerturbationWorker,
};

export const refOrbitWorkerPath = RefOrbitWorker;
