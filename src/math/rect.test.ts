import { describe, expect, it } from "vitest";
import { calcTargetRectsFromOffsetRects, calculateDivideArea, getOffsetRects } from "./rect";

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

    expect(() => calcTargetRectsFromOffsetRects(rects, 1, 100)).toThrow(
      "rects.length > expectedDivideCount",
    );
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
    // 端数20pxはminSide(100)未満なので手前のタイルに統合される
    const result = calcTargetRectsFromOffsetRects(rects, 100, 100);
    const expected = [{ x: 0, y: 0, width: 100, height: 120 }];
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
    // 端数20pxはminSide(100)未満なので統合される
    // 2つ目のrectは50x50だがminSide=100に拡張される
    const result = calcTargetRectsFromOffsetRects(rects, 100, 100);
    const expected = [
      { x: 0, y: 0, width: 100, height: 120 },
      { x: 100, y: 120, width: 100, height: 100 },
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
    const result = calcTargetRectsFromOffsetRects(rects, 2, 100);
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
    const result = calcTargetRectsFromOffsetRects(rects, 2, 1);
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

  it("端数タイルがminSide未満にならないこと", () => {
    // 500px を minSide=80 で分割: sideY=250, 残り250なので通常2分割
    // 310px を minSide=80 で分割: sideY=155, 残り155なので通常2分割
    // 420px を minSide=80 で分割: sideY=210, 残り210px → 1タイルとして収まる
    const rects = [
      {
        x: 0,
        y: 0,
        width: 250,
        height: 250,
      },
    ];
    // 250 / 2 = 125, 端数なし
    const result = calcTargetRectsFromOffsetRects(rects, 2, 80);
    for (const r of result) {
      expect(r.width).toBeGreaterThanOrEqual(80);
      expect(r.height).toBeGreaterThanOrEqual(80);
    }
  });

  it("端数タイルが統合される具体的なケース", () => {
    // 幅180pxをminSide=80で2分割しようとすると sideX=90
    // 残り90px >= minSide なので統合されない → 90, 90
    const rects = [{ x: 0, y: 0, width: 180, height: 100 }];
    const result = calcTargetRectsFromOffsetRects(rects, 2, 80);
    expect(result).toEqual([
      { x: 0, y: 0, width: 90, height: 100 },
      { x: 90, y: 0, width: 90, height: 100 },
    ]);
  });

  it("端数タイルが統合されるケース（端数がminSide未満）", () => {
    // 幅250pxをminSide=80で2分割: sideX=125
    // 残り125px >= minSide → 統合不要 → 125, 125
    // 幅210pxをminSide=80で2分割: sideX=105
    // 残り105px >= minSide → 統合不要
    // 幅170pxをminSide=80で2分割: sideX=85
    // 残り85px >= minSide → 統合不要
    // 幅150pxをminSide=80で2分割: sideX=75→minSideで80に
    // 残り70px < minSide → 統合 → 150px 1タイル
    const rects = [{ x: 0, y: 0, width: 150, height: 100 }];
    const result = calcTargetRectsFromOffsetRects(rects, 2, 80);
    expect(result).toEqual([{ x: 0, y: 0, width: 150, height: 100 }]);
  });

  it("入力rectの辺がminSide未満の場合にminSideに拡張される", () => {
    // 高さ9pxのrectはminSide=80に拡張される
    const rects = [{ x: 0, y: 591, width: 800, height: 9 }];
    const result = calcTargetRectsFromOffsetRects(rects, 2, 80);
    for (const r of result) {
      expect(r.width).toBeGreaterThanOrEqual(80);
      expect(r.height).toBeGreaterThanOrEqual(80);
    }
    // 位置は元のまま、高さが拡張される
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(591);
  });

  it("入力rectの両辺がminSide未満の場合に両方拡張される", () => {
    const rects = [{ x: 750, y: 550, width: 30, height: 20 }];
    const result = calcTargetRectsFromOffsetRects(rects, 1, 80);
    expect(result).toEqual([{ x: 750, y: 550, width: 80, height: 80 }]);
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
    const result = calcTargetRectsFromOffsetRects(rects, 6, 10);
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

  it("極小の移動量でもoffset値そのままの矩形を返す（X方向のみ）", () => {
    const result = getOffsetRects(W, H, { x: 2, y: 0 });
    expect(result).toEqual([{ x: 798, y: 0, width: 2, height: 600 }]);
  });

  it("極小の移動量でもoffset値そのままの矩形を返す（Y方向のみ）", () => {
    const result = getOffsetRects(W, H, { x: 0, y: -3 });
    expect(result).toEqual([{ x: 0, y: 0, width: 800, height: 3 }]);
  });

  it("極小の移動量でもoffset値そのままの矩形を返す（両方向）", () => {
    const result = getOffsetRects(W, H, { x: 2, y: 3 });
    expect(result).toEqual([
      { x: 0, y: 597, width: 800, height: 3 },
      { x: 798, y: 0, width: 2, height: 597 },
    ]);
  });

  it("横長矩形と縦長矩形が重複しない", () => {
    const result = getOffsetRects(W, H, { x: 1, y: -1 });
    const [horizontal, vertical] = result;
    // 横長矩形の下端 === 縦長矩形の上端
    expect(horizontal.y + horizontal.height).toBe(vertical.y);
  });
});
