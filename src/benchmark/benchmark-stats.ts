export type Stats = {
  min: number;
  max: number;
  mean: number;
  median: number;
};

/**
 * 数値配列からmin/max/mean/medianを計算する
 */
export const computeStats = (values: number[]): Stats => {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const mid = sorted.length / 2;
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];
  return { min, max, mean, median };
};
