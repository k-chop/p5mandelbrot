import { describe, expect, it } from "vitest";
import { bufferLocalLogicalIndex } from "./rendering";

describe("bufferLocalLogicalIndex", () => {
  it("resolutionが1の場合、どこを指定しても0", () => {
    const result = bufferLocalLogicalIndex(
      25,
      25,
      { x: 0, y: 0, width: 50, height: 50 },
      { width: 1, height: 1 },
    );
    expect(result).toBe(0);
  });

  it("resolutionよりrectが大きいケース", () => {
    const result = bufferLocalLogicalIndex(
      3,
      3,
      { x: 0, y: 0, width: 4, height: 4 },
      { width: 2, height: 2 },
    );
    expect(result).toBe(3);
  });

  it("resolutionよりrectが小さいケース", () => {
    const result = bufferLocalLogicalIndex(
      50,
      50,
      { x: 50, y: 50, width: 50, height: 50 },
      { width: 2, height: 2 },
    );
    expect(result).toBe(0);

    const result2 = bufferLocalLogicalIndex(
      99,
      99,
      { x: 50, y: 50, width: 50, height: 50 },
      { width: 2, height: 2 },
    );
    expect(result2).toBe(3);
  });

  it("rectが画面をはみ出すケース", () => {
    const result = bufferLocalLogicalIndex(
      99,
      99,
      { x: -100, y: -100, width: 200, height: 200 },
      { width: 1, height: 1 },
    );
    expect(result).toBe(0);
  });
});
