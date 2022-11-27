import { describe, expect, it } from "vitest";
import { calculateDivideArea, divideRect } from "./rect";

describe("calculateDivideArea", () => {
  it("16", () => {
    expect(calculateDivideArea(16)).toEqual({
      longSideCount: 4,
      shortSideCount: 4,
    });
  });

  it("1", () => {
    expect(calculateDivideArea(1)).toEqual({
      longSideCount: 1,
      shortSideCount: 1,
    });
  });

  it("2", () => {
    expect(calculateDivideArea(2)).toEqual({
      longSideCount: 2,
      shortSideCount: 1,
    });
  });

  it("6", () => {
    expect(calculateDivideArea(6)).toEqual({
      longSideCount: 3,
      shortSideCount: 2,
    });
  });

  it("64", () => {
    expect(calculateDivideArea(64)).toEqual({
      longSideCount: 8,
      shortSideCount: 8,
    });
  });

  it("128", () => {
    expect(calculateDivideArea(128)).toEqual({
      longSideCount: 16,
      shortSideCount: 8,
    });
  });
});

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
    const result = divideRect(rects, 2, 1);
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
        height: 150,
        width: 150,
        x: 200,
        y: 200,
      },
      {
        height: 150,
        width: 150,
        x: 350,
        y: 200,
      },
      {
        height: 150,
        width: 150,
        x: 200,
        y: 350,
      },
      {
        height: 150,
        width: 150,
        x: 350,
        y: 350,
      },
    ];
    expect(expected).toEqual(result);
  });
});
