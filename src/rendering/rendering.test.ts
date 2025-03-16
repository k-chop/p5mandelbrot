import { describe, expect, it } from "vitest";
import { bufferLocalLogicalIndex } from "./p5-renderer";

describe("bufferLocalLogicalIndex", () => {
  it("resolutionが1の場合、どこを指定しても0", () => {
    const [result] = bufferLocalLogicalIndex(
      25,
      25,
      { x: 0, y: 0, width: 50, height: 50 },
      { width: 1, height: 1 },
    );
    expect(result).toBe(0);
  });

  it("resolutionよりrectが大きいケース", () => {
    const [result] = bufferLocalLogicalIndex(
      3,
      3,
      { x: 0, y: 0, width: 4, height: 4 },
      { width: 2, height: 2 },
    );
    expect(result).toBe(3);
  });

  it("左上と右下の値が正しく取れる", () => {
    const [result] = bufferLocalLogicalIndex(
      50,
      50,
      { x: 50, y: 50, width: 50, height: 50 },
      { width: 2, height: 2 },
    );
    expect(result).toBe(0);

    const [result2] = bufferLocalLogicalIndex(
      99,
      99,
      { x: 50, y: 50, width: 50, height: 50 },
      { width: 2, height: 2 },
    );
    expect(result2).toBe(3);
  });

  it("rectが画面をはみ出すケース", () => {
    const [result] = bufferLocalLogicalIndex(
      99,
      99,
      { x: -100, y: -100, width: 200, height: 200 },
      { width: 1, height: 1 },
    );
    expect(result).toBe(0);
  });

  describe("isSuperSampledがtrueの場合", () => {
    it("4つのindexを返す", () => {
      const result = bufferLocalLogicalIndex(
        0,
        0,
        { x: 0, y: 0, width: 50, height: 50 },
        { width: 100, height: 100 },
        true,
      );
      expect(result).toEqual([0, 1, 100, 101]);
    });

    it("左上から1つ隣の点を返したとき、2刻みになる", () => {
      const result = bufferLocalLogicalIndex(
        1,
        0,
        { x: 0, y: 0, width: 50, height: 50 },
        { width: 100, height: 100 },
        true,
      );
      expect(result).toEqual([2, 3, 102, 103]);
    });

    it("右下を指定した場合も4点を返す", () => {
      const result = bufferLocalLogicalIndex(
        49,
        49,
        { x: 0, y: 0, width: 50, height: 50 },
        { width: 100, height: 100 },
        true,
      );
      expect(result).toEqual([9898, 9899, 9998, 9999]);
    });
  });
});
