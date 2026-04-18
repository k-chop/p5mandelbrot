export type Stats = {
  min: number;
  max: number;
  trimmedMean: number;
};

/**
 * 数値配列からmin/max/trimmedMeanを計算する
 *
 * trimmedMean: 最小と最大を1つずつ除いた平均。
 * サンプル数<=2のときは素のmean。
 * N=5のような少ないサンプル数での外れ値耐性を上げるため。
 */
export const computeStats = (values: number[]): Stats => {
  if (values.length === 0) {
    return { min: 0, max: 0, trimmedMean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const trimmed = sorted.length > 2 ? sorted.slice(1, -1) : sorted;
  const trimmedMean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return { min, max, trimmedMean };
};
