import { DEFAULT_N, height, isSameParams, width } from "@/mandelbrot";
import { getStore, updateStore } from "@/store/store";
import type { MandelbrotParams, OffsetParams } from "@/types";
import { prepareWorkerPool } from "@/worker-pool/pool-instance";
import { cycleWorkerType } from "@/worker-pool/worker-pool";
import BigNumber from "bignumber.js";

let lastCalc: MandelbrotParams = {
  x: new BigNumber(0),
  y: new BigNumber(0),
  r: new BigNumber(0),
  N: 0,
  mode: "normal",
};

let prevBatchId = "";

let currentParams: MandelbrotParams = {
  x: new BigNumber(
    "-1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125",
  ),
  y: new BigNumber(
    "0.1360385756605832424157267469300867279712448592945066056412400128811080204929672099044430962984916043688336280108617007855875705619618940154923777370644654005043363385",
  ),
  r: new BigNumber("1.999999999999998080000000000000883199999999999740928e-7"),
  N: DEFAULT_N,
  mode: "normal",
};

let offsetParams: OffsetParams = {
  x: 0,
  y: 0,
};

let scaleParams = {
  scaleAtX: Math.round(width / 2),
  scaleAtY: Math.round(height / 2),
  scale: 1,
};

export const getPrevBatchId = () => prevBatchId;
export const setPrevBatchId = (id: string) => {
  prevBatchId = id;
};

export const getCurrentParams = () => currentParams;
export const getCanvasSize = () => ({ width, height });

export const updateCurrentParams = () => {
  lastCalc = { ...currentParams };
};

export const setCurrentParams = (params: Partial<MandelbrotParams>) => {
  const needModeChange =
    params.mode != null && currentParams.mode !== params.mode;
  const needResetOffset = params.r != null && !currentParams.r.eq(params.r);

  currentParams = { ...currentParams, ...params };

  updateStore("r", currentParams.r);
  updateStore("N", currentParams.N);
  updateStore("mode", currentParams.mode);

  if (needModeChange) {
    const workerCount = getStore("workerCount");
    prepareWorkerPool(workerCount, currentParams.mode);
    setOffsetParams({ x: 0, y: 0 });
  }
  if (needResetOffset) {
    setOffsetParams({ x: 0, y: 0 });
  }
};
export const setOffsetParams = (params: Partial<OffsetParams>) => {
  offsetParams = { ...offsetParams, ...params };
};
export const getOffsetParams = () => offsetParams;
export const setScaleParams = (params: Partial<typeof scaleParams>) => {
  scaleParams = { ...scaleParams, ...params };
};
export const resetScaleParams = () =>
  setScaleParams({
    scaleAtX: Math.round(width / 2),
    scaleAtY: Math.round(height / 2),
    scale: 1,
  });
export const getScaleParams = () => scaleParams;
export const resetIterationCount = () => setCurrentParams({ N: DEFAULT_N });
export const setDeepIterationCount = () =>
  setCurrentParams({ N: DEFAULT_N * 20 });
export const resetRadius = () => setCurrentParams({ r: new BigNumber("2.0") });
export const cycleMode = () => {
  const mode = cycleWorkerType();
  setCurrentParams({ mode });
  setOffsetParams({ x: 0, y: 0 });
};
export const zoom = (times: number) => {
  if (1 < times && currentParams.r.times(times).gte(5)) {
    return;
  }

  currentParams.r = currentParams.r.times(times);
  setOffsetParams({ x: 0, y: 0 });
};
export const paramsChanged = () => {
  return !isSameParams(lastCalc, currentParams);
};
