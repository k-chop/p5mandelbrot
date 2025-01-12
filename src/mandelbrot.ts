import BigNumber from "bignumber.js";
import {
  removeUnusedIterationCache,
  scaleIterationCacheAroundPoint,
  setIterationCache,
  translateRectInIterationCache,
} from "./aggregator/aggregator";
import {
  clearMainBuffer,
  getCanvasSize,
  renderToMainBuffer,
} from "./camera/camera";
import {
  getCurrentParams,
  getOffsetParams,
  getPrevBatchId,
  getScaleParams,
  resetScaleParams,
  setPrevBatchId,
  updateCurrentParams,
} from "./mandelbrot-state/mandelbrot-state";
import { divideRect, getOffsetRects, Rect } from "./rect";
import { getStore, updateStoreWith } from "./store/store";
import { MandelbrotParams } from "./types";
import { getWorkerCount } from "./worker-pool/pool-instance";
import {
  cancelBatch,
  registerBatch,
  startBatch,
} from "./worker-pool/worker-pool";

export const DEFAULT_N = 500;

export const GLITCHED_POINT_ITERATION = 4294967295;

export const togglePinReference = () => {
  if (getCurrentParams().mode !== "perturbation") return;

  const newValue = updateStoreWith("shouldReuseRefOrbit", (t) => !t);

  console.debug(`Reference orbit has pinned: ${newValue}`);
};

export const calcVars = (
  mouseX: number,
  mouseY: number,
  width: number,
  height: number,
  currentParams: MandelbrotParams = getCurrentParams(),
) => {
  // [-1, 1]に変換
  const normalizedMouseX = new BigNumber(2 * mouseX).div(width).minus(1);
  const normalizedMouseY = new BigNumber(2 * mouseY).div(height).minus(1);

  const scaleX = width / Math.min(width, height);
  const scaleY = height / Math.min(width, height);

  const complexMouseX = currentParams.x.plus(
    normalizedMouseX.times(currentParams.r).times(scaleX),
  );
  const complexMouseY = currentParams.y.minus(
    normalizedMouseY.times(currentParams.r).times(scaleY),
  );

  const r = currentParams.r;
  const N = currentParams.N;

  return {
    mouseX: complexMouseX,
    mouseY: complexMouseY,
    r,
    N,
  };
};

export const cloneParams = (params: MandelbrotParams): MandelbrotParams => ({
  x: BigNumber(params.x),
  y: BigNumber(params.y),
  r: BigNumber(params.r),
  N: params.N,
  mode: params.mode,
});

export const startCalculation = async (
  onComplete: (elapsed: number) => void,
  onTranslated: () => void,
) => {
  updateCurrentParams();

  const currentBatchId = crypto.randomUUID();
  startBatch(currentBatchId);
  cancelBatch(getPrevBatchId());
  setPrevBatchId(currentBatchId);

  const divideRectCount = getWorkerCount("calc-iteration");
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();

  let calculationRects = divideRect(
    [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }],
    divideRectCount,
  );

  const offsetParams = getOffsetParams();

  if (offsetParams.x !== 0 || offsetParams.y !== 0) {
    const offsetX = offsetParams.x;
    const offsetY = offsetParams.y;

    // 移動した分の再描画範囲を計算
    const iterationBufferTransferedRect = {
      x: offsetX >= 0 ? 0 : Math.abs(offsetX),
      y: offsetY >= 0 ? 0 : Math.abs(offsetY),
      width: canvasWidth - Math.abs(offsetX),
      height: canvasHeight - Math.abs(offsetY),
    } satisfies Rect;

    // 画面pixel位置でキャッシュを持っているのでここで移動させている
    translateRectInIterationCache(offsetX, offsetY);
    removeUnusedIterationCache();

    // 新しく計算しない部分を先に描画
    clearMainBuffer();
    renderToMainBuffer(iterationBufferTransferedRect);

    const expectedDivideCount = Math.max(divideRectCount, 2);
    calculationRects = divideRect(
      getOffsetRects(canvasWidth, canvasHeight),
      expectedDivideCount,
    );
  } else {
    // 拡縮の場合は倍率を指定してキャッシュを書き換える
    const { scaleAtX, scaleAtY, scale } = getScaleParams();

    const scaled = scaleIterationCacheAroundPoint(
      scaleAtX,
      scaleAtY,
      scale,
      canvasWidth,
      canvasHeight,
    );
    setIterationCache(scaled);
    removeUnusedIterationCache();

    clearMainBuffer();
    renderToMainBuffer();

    resetScaleParams();
  }

  // ドラッグ中に描画をずらしていたのを戻す
  onTranslated();

  const currentParams = getCurrentParams();

  const units = calculationRects.map((rect) => ({
    rect,
    mandelbrotParams: currentParams,
  }));

  const terminator = new SharedArrayBuffer(getWorkerCount());

  registerBatch(currentBatchId, units, {
    onComplete,
    onChangeProgress: () => {},
    mandelbrotParams: currentParams,
    pixelWidth: canvasWidth,
    pixelHeight: canvasHeight,
    terminator,
    shouldReuseRefOrbit: getStore("shouldReuseRefOrbit"),
  });
};

export const isSameParams = (a: MandelbrotParams, b: MandelbrotParams) =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.N === b.N && a.mode === b.mode;
