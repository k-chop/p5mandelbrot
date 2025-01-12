import BigNumber from "bignumber.js";
import {
  removeUnusedIterationCache,
  scaleIterationCacheAroundPoint,
  setIterationCache,
  translateRectInIterationCache,
} from "./aggregator/aggregator";
import { clearMainBuffer, renderToMainBuffer } from "./camera/camera";
import { divideRect, Rect } from "./rect";
import { getStore, updateStore, updateStoreWith } from "./store/store";
import { MandelbrotParams, OffsetParams } from "./types";
import { getWorkerCount, prepareWorkerPool } from "./worker-pool/pool-instance";
import {
  cancelBatch,
  cycleWorkerType,
  registerBatch,
  startBatch,
} from "./worker-pool/worker-pool";

const DEFAULT_N = 500;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;

export const GLITCHED_POINT_ITERATION = 4294967295;

let lastCalc: MandelbrotParams = {
  x: new BigNumber(0),
  y: new BigNumber(0),
  r: new BigNumber(0),
  N: 0,
  mode: "normal",
};

let prevBatchId = "";

const width = DEFAULT_WIDTH;
const height = DEFAULT_HEIGHT;

export const togglePinReference = () => {
  if (getCurrentParams().mode !== "perturbation") return;

  const newValue = updateStoreWith("shouldReuseRefOrbit", (t) => !t);

  console.debug(`Reference orbit has pinned: ${newValue}`);
};

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

export const calcVars = (
  mouseX: number,
  mouseY: number,
  width: number,
  height: number,
) => {
  const normalizedMouseX = new BigNumber(2 * mouseX).div(width).minus(1);
  const normalizedMouseY = new BigNumber(2 * mouseY).div(height).minus(1);

  const scaleX = width / Math.min(width, height);
  const scaleY = height / Math.min(width, height);

  const currentMouseX = currentParams.x.plus(
    normalizedMouseX.times(currentParams.r).times(scaleX),
  );
  const currentMouseY = currentParams.y.minus(
    normalizedMouseY.times(currentParams.r).times(scaleY),
  );

  const r = currentParams.r;
  const N = currentParams.N;

  return {
    mouseX: currentMouseX,
    mouseY: currentMouseY,
    r,
    N,
  };
};

export const getCanvasSize = () => ({ width, height });

export const getCurrentParams = () => currentParams;

export const cloneParams = (params: MandelbrotParams): MandelbrotParams => ({
  x: BigNumber(params.x),
  y: BigNumber(params.y),
  r: BigNumber(params.r),
  N: params.N,
  mode: params.mode,
});

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

let scaleParams = {
  scaleAtX: Math.round(width / 2),
  scaleAtY: Math.round(height / 2),
  scale: 1,
};
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

export const startCalculation = async (
  onComplete: (elapsed: number) => void,
  onTranslated: () => void,
) => {
  updateCurrentParams();

  const currentBatchId = crypto.randomUUID();
  startBatch(currentBatchId);
  cancelBatch(prevBatchId);
  prevBatchId = currentBatchId;

  const divideRectCount = getWorkerCount("calc-iteration");

  let calculationRects = divideRect(
    [{ x: 0, y: 0, width, height }],
    divideRectCount,
  );

  if (offsetParams.x !== 0 || offsetParams.y !== 0) {
    const offsetX = offsetParams.x;
    const offsetY = offsetParams.y;

    // FIXME: 拡大待ち中や移動が終わる前に再度移動すると表示が壊れる
    // 拡大開始したときに既にCacheが消えてるからそりゃそうだ
    // なんとかせい

    // 移動した分の再描画範囲を計算
    const iterationBufferTransferedRect = {
      x: offsetX >= 0 ? 0 : Math.abs(offsetX),
      y: offsetY >= 0 ? 0 : Math.abs(offsetY),
      width: width - Math.abs(offsetX),
      height: height - Math.abs(offsetY),
    } satisfies Rect;

    // 画面pixel位置でキャッシュを持っているのでここで移動させている
    translateRectInIterationCache(offsetX, offsetY);
    removeUnusedIterationCache();

    // 新しく計算しない部分を先に描画
    clearMainBuffer();
    renderToMainBuffer(iterationBufferTransferedRect);

    const expectedDivideCount = Math.max(divideRectCount, 2);
    calculationRects = divideRect(getOffsetRects(), expectedDivideCount);
  } else {
    // 拡縮の場合は倍率を指定してキャッシュを書き換える
    const { scaleAtX, scaleAtY, scale } = getScaleParams();

    const scaled = scaleIterationCacheAroundPoint(
      scaleAtX,
      scaleAtY,
      scale,
      width,
      height,
    );
    setIterationCache(scaled);
    removeUnusedIterationCache();

    clearMainBuffer();
    renderToMainBuffer();

    resetScaleParams();
  }

  // ドラッグ中に描画をずらしていたのを戻す
  onTranslated();

  const units = calculationRects.map((rect) => ({
    rect,
    mandelbrotParams: currentParams,
  }));

  const terminator = new SharedArrayBuffer(getWorkerCount());

  registerBatch(currentBatchId, units, {
    onComplete,
    onChangeProgress: () => {},
    mandelbrotParams: currentParams,
    pixelWidth: width,
    pixelHeight: height,
    terminator,
    shouldReuseRefOrbit: getStore("shouldReuseRefOrbit"),
  });
};

const isSameParams = (a: MandelbrotParams, b: MandelbrotParams) =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.N === b.N && a.mode === b.mode;

const getOffsetRects = (): Rect[] => {
  const offsetX = offsetParams.x;
  const offsetY = offsetParams.y;

  const rects: Rect[] = [];

  if (offsetY !== 0) {
    // (1) 上下の横長矩形（offsetYが0なら存在しない）
    rects.push({
      x: 0,
      y: offsetY > 0 ? height - offsetY : 0,
      width,
      height: Math.abs(offsetY),
    });
  }
  if (offsetX !== 0) {
    // (2) 1に含まれる分を除いた左右の縦長矩形（offsetXが0なら存在しない）
    rects.push({
      x: offsetX > 0 ? width - offsetX : 0,
      y: offsetY > 0 ? 0 : Math.abs(offsetY),
      width: Math.abs(offsetX),
      height: height - Math.abs(offsetY),
    });
  }

  return rects;
};
