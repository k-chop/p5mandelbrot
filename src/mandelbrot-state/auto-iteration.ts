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

  const narrowHalfW = canvasWidth / (2 * scaleFactor);
  const narrowHalfH = canvasHeight / (2 * scaleFactor);
  const narrowSamples = sampleIterationsInRegion(
    zoomCenterX - narrowHalfW,
    zoomCenterY - narrowHalfH,
    zoomCenterX + narrowHalfW,
    zoomCenterY + narrowHalfH,
    GRID_SIZE,
  );
  const validNarrow = narrowSamples.filter((s) => s >= 0);

  if (validNarrow.length === 0) return currentN;

  if (scaleFactor >= 1) {
    const wideHalfW = canvasWidth / 4;
    const wideHalfH = canvasHeight / 4;
    const wideSamples = sampleIterationsInRegion(
      zoomCenterX - wideHalfW,
      zoomCenterY - wideHalfH,
      zoomCenterX + wideHalfW,
      zoomCenterY + wideHalfH,
      GRID_SIZE,
    );
    const validWide = wideSamples.filter((s) => s >= 0);
    const wideMaxedRatio =
      validWide.length > 0 ? validWide.filter((s) => s >= currentN).length / validWide.length : 0;

    return calcForZoomIn(validNarrow, currentN, manualN, wideMaxedRatio, currentR, scaleFactor);
  } else {
    return calcForZoomOut(validNarrow, currentN, manualN);
  }
};

const calcForZoomIn = (
  samples: number[],
  currentN: number,
  manualN: number,
  wideMaxedRatio: number,
  currentR: number,
  scaleFactor: number,
): number => {
  const maxedCount = samples.filter((s) => s >= currentN).length;
  const maxedRatio = maxedCount / samples.length;

  const nonMaxed = samples.filter((s) => s < currentN);
  const highestNonMaxed = nonMaxed.length > 0 ? Math.max(...nonMaxed) : -1;

  let suggestedN = currentN;

  if (maxedRatio < 0.05) {
    suggestedN = currentN;
  } else if (maxedRatio <= 0.6) {
    if (highestNonMaxed > 0) {
      suggestedN = Math.max(currentN, Math.ceil(highestNonMaxed * 1.5));
    }
  } else if (maxedRatio < 1.0) {
    if (highestNonMaxed > 10) {
      suggestedN = Math.max(currentN, Math.ceil(highestNonMaxed * 1.3));
    }
  } else {
    // 狭域の全サンプルがmaxed: 広域サンプルで境界付近か判定
    if (wideMaxedRatio >= 0.3) {
      const postZoomR = currentR / scaleFactor;
      if (postZoomR < INITIAL_R) {
        const logN = DEFAULT_N + AUTO_N_SCALE_FACTOR * Math.log2(INITIAL_R / postZoomR);
        suggestedN = Math.max(currentN, Math.ceil(logN));
      }
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
