import { describe, expect, it } from "vitest";
import { calcScoreStats } from "./export-eval-data";
import type { BlockDebugInfo } from "./find-interesting-points";

describe("calcScoreStats", () => {
  it("空配列で全て0を返す", () => {
    const stats = calcScoreStats([]);
    expect(stats).toEqual({
      totalBlocks: 0,
      nonZeroCount: 0,
      min: 0,
      max: 0,
      mean: 0,
    });
  });

  it("全ブロックがscore=0の場合", () => {
    const blocks: BlockDebugInfo[] = [
      { bx: 0, by: 0, blockSize: 8, factors: {}, score: 0, peak: null },
      { bx: 8, by: 0, blockSize: 8, factors: {}, score: 0, peak: null },
    ];

    const stats = calcScoreStats(blocks);
    expect(stats.totalBlocks).toBe(2);
    expect(stats.nonZeroCount).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.mean).toBe(0);
  });

  it("正しくmin, max, mean, nonZeroCountを算出する", () => {
    const blocks: BlockDebugInfo[] = [
      { bx: 0, by: 0, blockSize: 8, factors: {}, score: 0, peak: null },
      { bx: 8, by: 0, blockSize: 8, factors: {}, score: 0.1, peak: { x: 8, y: 0, iteration: 100 } },
      {
        bx: 16,
        by: 0,
        blockSize: 8,
        factors: {},
        score: 0.3,
        peak: { x: 16, y: 0, iteration: 200 },
      },
      {
        bx: 24,
        by: 0,
        blockSize: 8,
        factors: {},
        score: 0.2,
        peak: { x: 24, y: 0, iteration: 150 },
      },
    ];

    const stats = calcScoreStats(blocks);
    expect(stats.totalBlocks).toBe(4);
    expect(stats.nonZeroCount).toBe(3);
    expect(stats.min).toBe(0.1);
    expect(stats.max).toBe(0.3);
    expect(stats.mean).toBeCloseTo(0.15, 10);
  });

  it("全ブロックがnonzeroの場合のmin", () => {
    const blocks: BlockDebugInfo[] = [
      { bx: 0, by: 0, blockSize: 8, factors: {}, score: 0.5, peak: { x: 0, y: 0, iteration: 100 } },
      { bx: 8, by: 0, blockSize: 8, factors: {}, score: 0.2, peak: { x: 8, y: 0, iteration: 200 } },
    ];

    const stats = calcScoreStats(blocks);
    expect(stats.min).toBe(0.2);
    expect(stats.max).toBe(0.5);
  });
});
