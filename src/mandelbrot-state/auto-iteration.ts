import { getIterationCache, sampleIterationsInRegion } from "@/iteration-buffer/iteration-buffer";

const INITIAL_R = 2.0;
const AUTO_N_SCALE_FACTOR = 50;
const DEFAULT_N = 500;
const GRID_SIZE = 16;

/**
 * ズーム操作時に適切なNを計算する
 *
 * iteration cacheが存在すればズーム先領域をサンプリングして分析、
 * 存在しなければmagnificationベースの対数式をフォールバックとして使用する
 */
export const calcAutoN = (
  zoomCenterX: number,
  zoomCenterY: number,
  scaleFactor: number,
  canvasWidth: number,
  canvasHeight: number,
  currentN: number,
  currentR: number,
  manualN: number,
): number => {
  if (getIterationCache().length === 0) {
    const postZoomR = currentR / scaleFactor;
    if (postZoomR >= INITIAL_R) return Math.max(DEFAULT_N, manualN);
    const fallbackN = DEFAULT_N + AUTO_N_SCALE_FACTOR * Math.log2(INITIAL_R / postZoomR);
    return Math.max(Math.ceil(fallbackN), manualN);
  }

  const halfW = canvasWidth / (2 * scaleFactor);
  const halfH = canvasHeight / (2 * scaleFactor);
  const x1 = zoomCenterX - halfW;
  const y1 = zoomCenterY - halfH;
  const x2 = zoomCenterX + halfW;
  const y2 = zoomCenterY + halfH;

  const samples = sampleIterationsInRegion(x1, y1, x2, y2, GRID_SIZE);
  const validSamples = samples.filter((s) => s >= 0);

  if (validSamples.length === 0) return currentN;

  if (scaleFactor >= 1) {
    return calcForZoomIn(validSamples, currentN, manualN);
  } else {
    return calcForZoomOut(validSamples, currentN, manualN);
  }
};

const calcForZoomIn = (samples: number[], currentN: number, manualN: number): number => {
  const maxedCount = samples.filter((s) => s >= currentN).length;
  const maxedRatio = maxedCount / samples.length;

  const nonMaxed = samples.filter((s) => s < currentN);
  const highestNonMaxed = nonMaxed.length > 0 ? Math.max(...nonMaxed) : -1;

  let suggestedN = currentN;

  if (maxedRatio < 0.05) {
    suggestedN = currentN;
  } else if (maxedRatio <= 0.6) {
    if (highestNonMaxed > 0) {
      suggestedN = Math.max(currentN, highestNonMaxed * 2);
    }
  } else {
    if (highestNonMaxed > 10) {
      suggestedN = Math.max(currentN, Math.ceil(highestNonMaxed * 1.5));
    }
  }

  return Math.max(suggestedN, manualN);
};

const calcForZoomOut = (samples: number[], currentN: number, manualN: number): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  const p95Index = Math.floor(0.95 * sorted.length);
  const percentile95 = sorted[p95Index];

  const suggestedN = Math.max(percentile95 * 2, DEFAULT_N, manualN);

  return Math.min(suggestedN, currentN);
};
