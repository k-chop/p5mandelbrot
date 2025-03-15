import {
  removeUnusedIterationCache,
  scaleIterationCacheAroundPoint,
  setIterationCache,
  translateRectInIterationCache,
} from "./iteration-buffer/iteration-buffer";
import {
  getCurrentParams,
  getOffsetParams,
  getPrevBatchId,
  getScaleParams,
  markAsRenderedWithCurrentParams,
  resetOffsetParams,
  resetScaleParams,
  setPrevBatchId,
} from "./mandelbrot-state/mandelbrot-state";
import { getCalculationTargetRects, Rect } from "./math/rect";
import {
  clearMainBuffer,
  getCanvasSize,
  getWholeCanvasRect,
  renderToMainBuffer,
} from "./rendering/rendering";
import { getStore } from "./store/store";
import { getWorkerCount } from "./worker-pool/pool-instance";
import {
  cancelBatch,
  registerBatch,
  startBatch,
} from "./worker-pool/worker-pool";

/**
 * 現在のパラメータと設定で計算を開始する
 */
export const startCalculation = async (
  onComplete: (elapsed: number) => void,
  onTranslated: () => void,
) => {
  markAsRenderedWithCurrentParams();

  const currentBatchId = crypto.randomUUID();
  startBatch(currentBatchId);
  cancelBatch(getPrevBatchId());
  setPrevBatchId(currentBatchId);

  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();

  const rect = translateIterationCache(
    canvasWidth,
    canvasHeight,
    getOffsetParams(),
  );

  // 動かしたiteration cacheを使って再描画、これが描画が開始されるまでの画面になる
  removeUnusedIterationCache();
  clearMainBuffer();
  renderToMainBuffer(rect);

  // ドラッグ中に描画をずらしていたのを戻す
  onTranslated();

  // workerに分配するために描画範囲を分割
  const divideRectCount = getWorkerCount("calc-iteration");
  const currentParams = getCurrentParams();
  const calculationRects = getCalculationTargetRects(
    canvasWidth,
    canvasHeight,
    divideRectCount,
    getOffsetParams(),
  );
  const units = calculationRects.map((rect) => ({
    rect,
    mandelbrotParams: currentParams,
  }));

  const terminator = new SharedArrayBuffer(getWorkerCount());

  resetScaleParams();
  resetOffsetParams();

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

/**
 * 計算済みのiteration cacheを今回動かしたoffset, scaleに合わせて再配置する
 *
 * 移動の結果、再描画する必要のないrectを返す
 */
const translateIterationCache = (
  canvasWidth: number,
  canvasHeight: number,
  offsetParams = getOffsetParams(),
) => {
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

    translateRectInIterationCache(offsetX, offsetY);

    return iterationBufferTransferedRect;
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

    return getWholeCanvasRect();
  }
};
