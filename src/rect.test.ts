import { describe, expect, it } from "vitest";
import { divideRect } from "./rect";

describe("divideRect", () => {
  it("期待分割数が矩形の数より小さい場合はエラー", () => {
    const rects = [
      {
        x: 0,
        y: 0,
        width: 100,
        height: 120,
      },
      {
        x: 100,
        y: 120,
        width: 10,
        height: 10,
      },
    ];

    expect(() => divideRect(rects, 1, 100)).toThrowError();
  });

  it("対象が1の場合の分割", () => {
    const rects = [
      {
        x: 0,
        y: 0,
        width: 100,
        height: 120,
      },
    ];
    const result = divideRect(rects, 100, 100);
    const expected = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 100, width: 100, height: 20 },
    ];
    expect(expected).toEqual(result);
  });

  it("対象が複数の場合の分割", () => {
    const rects = [
      {
        x: 0,
        y: 0,
        width: 100,
        height: 120,
      },
      {
        x: 100,
        y: 120,
        width: 50,
        height: 50,
      },
    ];
    const result = divideRect(rects, 100, 100);
    const expected = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 100, width: 100, height: 20 },
      { x: 100, y: 120, width: 50, height: 50 },
    ];
    expect(expected).toEqual(result);
  });

  it("expectedDivideCountを超えない", () => {
    const rects = [
      {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
      {
        x: 200,
        y: 200,
        width: 300,
        height: 300,
      },
    ];
    const result = divideRect(rects, 2, 10);
    const expected = [
      {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
      {
        x: 200,
        y: 200,
        width: 300,
        height: 300,
      },
    ];
    expect(expected).toEqual(result);
  });

  it("expectedDivideCountを超えない2", () => {
    const rects = [
      {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
      {
        x: 200,
        y: 200,
        width: 300,
        height: 300,
      },
    ];
    const result = divideRect(rects, 6, 10);
    const expected = [
      {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
      {
        x: 200,
        y: 200,
        width: 300,
        height: 75,
      },
      {
        height: 75,
        width: 300,
        x: 200,
        y: 275,
      },
      {
        height: 75,
        width: 300,
        x: 200,
        y: 350,
      },
      {
        height: 75,
        width: 300,
        x: 200,
        y: 425,
      },
    ];
    expect(expected).toEqual(result);
  });
});
