import { describe, expect, it } from "vitest";
import { findInterestingPoints } from "./find-interesting-points";
import { findPeaks, normalizeIterations, peakMapToDebugBlocks } from "./peak-detector";

const N = 10000;
const SIZE = 256;

/** 各画素の iteration を関数で与えた buffer を作る */
const makeBuffer = (fn: (x: number, y: number) => number): Uint32Array => {
  const buffer = new Uint32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      buffer[y * SIZE + x] = Math.max(1, Math.min(N, Math.round(fn(x, y))));
    }
  }
  return buffer;
};

/** 中心 (cx, cy) から離れるほど iteration が下がるピーク */
const peakAt = (cx: number, cy: number, height: number) => (x: number, y: number) =>
  height / (1 + Math.hypot(x - cx, y - cy) / 10);

describe("findPeaks", () => {
  it("単一のピークの中心を検出する", () => {
    const buffer = makeBuffer(peakAt(128, 128, 5000));
    const { points } = findPeaks(buffer, SIZE, SIZE, N);
    expect(points).toHaveLength(1);
    expect(Math.hypot(points[0].x - 128, points[0].y - 128)).toBeLessThan(6);
  });

  it("2つのピークをスコア順に返す", () => {
    const buffer = makeBuffer((x, y) => peakAt(64, 64, 5000)(x, y) + peakAt(192, 192, 3000)(x, y));
    const { points } = findPeaks(buffer, SIZE, SIZE, N);
    expect(points).toHaveLength(2);
    expect(Math.hypot(points[0].x - 64, points[0].y - 64)).toBeLessThan(6);
    expect(Math.hypot(points[1].x - 192, points[1].y - 192)).toBeLessThan(6);
    expect(points[0].score).toBeGreaterThan(points[1].score);
  });

  it("平坦な画像からは何も検出しない", () => {
    const buffer = makeBuffer(() => 500);
    expect(findPeaks(buffer, SIZE, SIZE, N).points).toEqual([]);
  });

  it("尾根（x方向にだけピーク）は検出しない", () => {
    const buffer = makeBuffer((x) => 5000 / (1 + Math.abs(x - 128) / 10));
    expect(findPeaks(buffer, SIZE, SIZE, N).points).toEqual([]);
  });

  it("集合内部（N）の塊の中心をピークとして検出する", () => {
    const buffer = makeBuffer((x, y) => (Math.hypot(x - 128, y - 128) < 12 ? N : 100));
    const { points } = findPeaks(buffer, SIZE, SIZE, N);
    expect(points).toHaveLength(1);
    expect(Math.hypot(points[0].x - 128, points[0].y - 128)).toBeLessThan(6);
  });

  it("未計算（0）だけの画像からは何も検出しない", () => {
    const buffer = new Uint32Array(SIZE * SIZE);
    expect(findPeaks(buffer, SIZE, SIZE, N).points).toEqual([]);
  });
});

describe("normalizeIterations", () => {
  it("0 は NaN、N は有効最大値より大きい値になる", () => {
    const out = normalizeIterations(new Uint32Array([0, 10, 20, 30, 100]), 100);
    expect(Number.isNaN(out[0])).toBe(true);
    expect(out[4]).toBeGreaterThan(out[3]);
    expect(out[3]).toBeGreaterThan(out[1]);
  });
});

describe("findInterestingPoints (peak)", () => {
  it("デフォルトでピーク検出の結果を返し、debug 時はグリッドブロックを含む", () => {
    const buffer = makeBuffer(peakAt(128, 128, 5000));
    const points = findInterestingPoints(buffer, SIZE, SIZE, N);
    expect(points).toEqual(findPeaks(buffer, SIZE, SIZE, N).points);

    const { debugData } = findInterestingPoints(buffer, SIZE, SIZE, N, { debug: true });
    expect(debugData.gridBlocks.length).toBeGreaterThan(0);
    expect(Object.keys(debugData.gridBlocks[0].factors)).toContain("peak3");
  });

  it("peakMapToDebugBlocks はブロック数を上限内に収める", () => {
    const buffer = makeBuffer(peakAt(128, 128, 5000));
    const { map } = findPeaks(buffer, SIZE, SIZE, N, { stride: 1 });
    expect(peakMapToDebugBlocks(map).length).toBeLessThanOrEqual(40000);
  });
});
