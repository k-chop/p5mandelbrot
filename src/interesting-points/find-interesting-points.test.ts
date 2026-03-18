import { describe, expect, it } from "vitest";
import {
  calcGradientMagnitude,
  calcLocalEntropy,
  findBlockPeak,
  findInterestingPoints,
} from "./find-interesting-points";

describe("findInterestingPoints", () => {
  it("全ピクセルがN（集合内）→ 空配列", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(N);

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 4,
    });

    expect(result).toEqual([]);
  });

  it("全ピクセルが0（未計算）→ 空配列", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height);

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 4,
    });

    expect(result).toEqual([]);
  });

  it("単一ピーク → 正しい座標・iteration・スコアが返る", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(10);
    // (3, 3) に高いiteration値を配置
    buffer[3 * width + 3] = 50;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 5,
      minIteration: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(3);
    expect(result[0].y).toBe(3);
    expect(result[0].iteration).toBe(50);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("複数ピーク → topKで絞り込み、スコア降順", () => {
    const N = 1000;
    const width = 16;
    const height = 16;
    const buffer = new Uint32Array(width * height).fill(10);

    // ブロック(0,0)にピーク
    buffer[2 * width + 2] = 500;
    // ブロック(8,0)にピーク（周囲との差が大きい）
    buffer[2 * width + 10] = 800;
    // ブロック(0,8)にピーク
    buffer[10 * width + 2] = 300;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 2,
      minIteration: 5,
    });

    expect(result).toHaveLength(2);
    // スコア降順
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
  });

  it("バッファ端のピーク → エッジケースで勾配計算が正しい", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    // 左上角(0, 0)にピーク
    buffer[0] = 50;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 4,
      topK: 5,
      minIteration: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("エントロピーが同等なら勾配が大きい点が優先される", () => {
    const N = 1000;
    const width = 16;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(50);

    // ブロック(0,0): iteration=200、周囲は全部50 → 大きい勾配
    buffer[2 * width + 2] = 200;

    // ブロック(8,0): iteration=120、周囲は全部50 → 小さい勾配
    buffer[2 * width + 10] = 120;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 5,
      minIteration: 5,
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    // ブロック(0,0)の方が勾配が大きいので先に来る
    const first = result[0];
    const second = result[1];
    expect(first.x).toBe(2);
    expect(first.y).toBe(2);
    expect(second.x).toBe(10);
    expect(second.y).toBe(2);
    expect(first.score).toBeGreaterThan(second.score);
  });

  it("minIteration未満のピクセルは無視される", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(3);
    // minIteration=10 より低いので検出されない
    buffer[3 * width + 3] = 9;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      minIteration: 10,
    });

    expect(result).toEqual([]);
  });
});

describe("calcGradientMagnitude", () => {
  it("周囲と同じ値なら勾配0", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(50);

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    expect(result).toBe(0);
  });

  it("中心だけ値が異なれば正の勾配", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[1 * width + 1] = 50;

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    // 8方向全てで差が40 → sqrt(8 * 40^2) = sqrt(12800)
    expect(result).toBeCloseTo(Math.sqrt(8 * 40 * 40));
  });

  it("maxIterationの中心は勾配0を返す", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[1 * width + 1] = 100;

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    expect(result).toBe(0);
  });

  it("0の中心は勾配0を返す", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[1 * width + 1] = 0;

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    expect(result).toBe(0);
  });
});

describe("calcLocalEntropy", () => {
  it("全ピクセルが同じ値なら低エントロピー", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(50);

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    // 16ピクセル全て50 → unique=1, valid=16 → 1/16
    expect(result).toBeCloseTo(1 / 16);
  });

  it("多様な値があれば高エントロピー", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height);
    // 全ピクセルに異なる値を設定
    for (let i = 0; i < width * height; i++) {
      buffer[i] = i + 1; // 1~16
    }

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    // 16ピクセル全て異なる → unique=16, valid=16 → 1.0
    expect(result).toBe(1);
  });

  it("0とNは有効ピクセルに含まれない", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(50);
    buffer[0] = 0;
    buffer[1] = N;

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    // 14ピクセルが50 → unique=1, valid=14 → 1/14
    expect(result).toBeCloseTo(1 / 14);
  });

  it("有効ピクセルがなければ0", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(N);

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    expect(result).toBe(0);
  });
});

describe("findBlockPeak", () => {
  it("全部Nならnull", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(N);

    const result = findBlockPeak(buffer, 0, 0, 4, width, height, N, 10);

    expect(result).toBeNull();
  });

  it("ブロック内の最大iteration値のピクセルを返す", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(20);
    buffer[1 * width + 2] = 80;
    buffer[2 * width + 3] = 60;

    const result = findBlockPeak(buffer, 0, 0, 4, width, height, N, 10);

    expect(result).toEqual({ x: 2, y: 1, iteration: 80 });
  });

  it("ブロックがキャンバス端にはみ出ても正しく動作する", () => {
    const N = 100;
    const width = 6;
    const height = 6;
    const buffer = new Uint32Array(width * height).fill(20);
    // ブロック(4,4)は6x6キャンバスでは2x2しかない
    buffer[5 * width + 5] = 80;

    const result = findBlockPeak(buffer, 4, 4, 4, width, height, N, 10);

    expect(result).toEqual({ x: 5, y: 5, iteration: 80 });
  });
});
