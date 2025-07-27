const absTimeBrand = Symbol();
// 絶対時間を表すBranded Type
export type AbsoluteTime = number & { [absTimeBrand]: unknown };

/**
 * メインスレッド/Workerで共通の絶対時間を取るためのユーティリティ
 */
export const nowAbs = (): AbsoluteTime =>
  (performance.timeOrigin + performance.now()) as AbsoluteTime;
