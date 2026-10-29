import type { InterestingPoint } from "../find-interesting-points";
import type { ExpectedPoint } from "./render-scene";

/** 1シーンの評価結果 */
export interface SceneMetrics {
  /** 期待点のうち、tolerance 以内にマーカーがあったもの（再現率の分子） */
  hit: number;
  expected: number;
  /** どの期待点からも tolerance より遠いマーカーの数（誤検出） */
  falsePositive: number;
  detected: number;
  /** exclude 指定の点の tolerance 以内にマーカーが置かれた数（置かれてはいけない） */
  violation: number;
}

/**
 * 検出結果と期待点を突き合わせる。期待点1つにつきマーカー1つまでを対応付ける
 */
export const evaluateScene = (
  points: InterestingPoint[],
  expected: ExpectedPoint[],
  tolerance: number,
): SceneMetrics => {
  const tolSq = tolerance * tolerance;
  const used = new Set<number>();
  let hit = 0;
  let violation = 0;
  for (const e of expected.filter((e) => e.exclude)) {
    if (points.some((p) => (p.x - e.x) ** 2 + (p.y - e.y) ** 2 <= tolSq)) violation++;
  }
  const positive = expected.filter((e) => !e.exclude);
  for (const e of positive) {
    const idx = points.findIndex(
      (p, i) => !used.has(i) && (p.x - e.x) ** 2 + (p.y - e.y) ** 2 <= tolSq,
    );
    if (idx !== -1) {
      used.add(idx);
      hit++;
    }
  }
  const nearAny = (p: InterestingPoint) =>
    positive.some((e) => (p.x - e.x) ** 2 + (p.y - e.y) ** 2 <= tolSq);
  const falsePositive = points.filter((p) => !nearAny(p)).length;
  return { hit, expected: positive.length, falsePositive, detected: points.length, violation };
};
