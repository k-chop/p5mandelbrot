import { describe, expect, it } from "vitest";
import { calculateDivideArea, divideRect, getOffsetRects } from "./rect";

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

    expect(() => divideRect(rects, 1, 100)).toThrow("rects.length > expectedDivideCount");
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

  it("単純なケースの分割", () => {
    const rects = [
      {
        x: 0,
        y: 0,
        width: 800,
        height: 800,
      },
    ];
    const result = divideRect(rects, 2, 100);
    const expected = [
      { x: 0, y: 0, width: 800, height: 400 },
      { x: 0, y: 400, width: 800, height: 400 },
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

describe("getOffsetRects", () => {
  const W = 800;
  const H = 600;

  it("移動量が0の場合は空配列を返す", () => {
    expect(getOffsetRects(W, H, { x: 0, y: 0 })).toEqual([]);
  });

  it("右方向のみの移動", () => {
    const result = getOffsetRects(W, H, { x: 100, y: 0 });
    expect(result).toEqual([{ x: 700, y: 0, width: 100, height: 600 }]);
  });

  it("左方向のみの移動", () => {
    const result = getOffsetRects(W, H, { x: -100, y: 0 });
    expect(result).toEqual([{ x: 0, y: 0, width: 100, height: 600 }]);
  });

  it("下方向のみの移動", () => {
    const result = getOffsetRects(W, H, { x: 0, y: 100 });
    expect(result).toEqual([{ x: 0, y: 500, width: 800, height: 100 }]);
  });

  it("上方向のみの移動", () => {
    const result = getOffsetRects(W, H, { x: 0, y: -100 });
    expect(result).toEqual([{ x: 0, y: 0, width: 800, height: 100 }]);
  });

  it("右下方向の移動", () => {
    const result = getOffsetRects(W, H, { x: 100, y: 80 });
    expect(result).toEqual([
      { x: 0, y: 520, width: 800, height: 80 },
      { x: 700, y: 0, width: 100, height: 520 },
    ]);
  });

  it("左上方向の移動", () => {
    const result = getOffsetRects(W, H, { x: -100, y: -80 });
    expect(result).toEqual([
      { x: 0, y: 0, width: 800, height: 80 },
      { x: 0, y: 80, width: 100, height: 520 },
    ]);
  });

  it("極小の移動量でも最小サイズ(50px)が保証される（X方向のみ）", () => {
    const result = getOffsetRects(W, H, { x: 2, y: 0 });
    expect(result).toEqual([{ x: 750, y: 0, width: 50, height: 600 }]);
  });

  it("極小の移動量でも最小サイズ(50px)が保証される（Y方向のみ）", () => {
    const result = getOffsetRects(W, H, { x: 0, y: -3 });
    expect(result).toEqual([{ x: 0, y: 0, width: 800, height: 50 }]);
  });

  it("極小の移動量でも最小サイズ(50px)が保証される（両方向）", () => {
    const result = getOffsetRects(W, H, { x: 2, y: 3 });
    expect(result).toEqual([
      { x: 0, y: 550, width: 800, height: 50 },
      { x: 750, y: 0, width: 50, height: 550 },
    ]);
  });

  it("横長矩形と縦長矩形が重複しない", () => {
    const result = getOffsetRects(W, H, { x: 1, y: -1 });
    const [horizontal, vertical] = result;
    // 横長矩形の下端 === 縦長矩形の上端
    expect(horizontal.y + horizontal.height).toBe(vertical.y);
  });
});
