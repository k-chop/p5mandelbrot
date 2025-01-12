/** 与えられたnを、1になるまで2で割り続けた値を返すジェネレータ */
function* seqGenerator(n: number) {
  let i = n;
  while (i > 1) {
    yield i;
    i = Math.floor(i / 2);
  }
  yield 1;
}

/** 長さnに対してよい感じの分割数を得るための関数 */
function dividerSequence(n: number) {
  const result = [];
  for (const i of seqGenerator(n)) {
    result.push(i);
  }
  // 最初の2要素は荒すぎるので落とす
  return result.slice(2);
}

/**
 * できるだけ等間隔に要素を取りつつ指定した長さに縮める関数
 */
function thin<T>(arr: T[], length: number): T[] {
  if (length >= arr.length || length < 3) {
    return arr;
  }

  const result = [arr[0]];
  const interval = (arr.length - 1) / (length - 1);

  for (let i = 1; i < length - 1; i++) {
    result.push(arr[Math.round(i * interval)]);
  }

  result.push(arr[arr.length - 1]);

  return result;
}

/**
 * 領域を `resolutionCount` 段階の低解像度で描画するための差分シーケンスを生成する
 *
 * 各要素に入っているdiff分飛ばしながら描画することで、低解像度で描画できるやつ
 */
export function generateLowResDiffSequence(
  resolutionCount: number,
  areaWidth: number,
  areaHeight: number,
) {
  let xDiffs = thin(dividerSequence(areaWidth), resolutionCount);
  let yDiffs = thin(dividerSequence(areaHeight), resolutionCount);

  if (xDiffs.length !== yDiffs.length) {
    const minLen = Math.min(xDiffs.length, yDiffs.length);
    xDiffs = thin(xDiffs, minLen);
    yDiffs = thin(yDiffs, minLen);
  }

  return { xDiffs, yDiffs };
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function repeatUntil<T>(base: T[], length: number) {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(base[i % base.length]);
  }
  return result;
}

export function safeParseInt(value: string, defaultValue = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
