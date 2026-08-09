import type { IterationBuffer } from "../types";
import { describe, expect, it } from "vitest";
import {
  consolidateIterationCache,
  getIterationCache,
  scaleIterationCacheAroundPoint,
  scaleRectAroundPoint,
  setIterationCache,
} from "./iteration-buffer";

describe("scaleRectAroundPoint", () => {
  it("原点で1.0倍しても変化しない", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };

    const result = scaleRectAroundPoint(rect, 0, 0, 1.0);

    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("原点で2.0倍", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };

    const result = scaleRectAroundPoint(rect, 0, 0, 2.0);

    expect(result).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });

  it("右端で2.0倍", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };

    const result = scaleRectAroundPoint(rect, 100, 0, 2.0);

    expect(result).toEqual({ x: -100, y: 0, width: 200, height: 200 });
  });

  it("終点で2.0倍", () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };

    const result = scaleRectAroundPoint(rect, 100, 100, 2.0);

    expect(result).toEqual({ x: -100, y: -100, width: 200, height: 200 });
  });

  it("rectの位置をずらしたパターン", () => {
    const rect = { x: 50, y: 0, width: 50, height: 50 };

    const result = scaleRectAroundPoint(rect, 100, 50, 2.0);

    expect(result).toEqual({ x: 0, y: -50, width: 100, height: 100 });
  });

  it("rectの外の点を中心に動かすパターン", () => {
    const rect = { x: 50, y: 50, width: 50, height: 50 };

    const result = scaleRectAroundPoint(rect, 0, 0, 2.0);

    expect(result).toEqual({ x: 100, y: 100, width: 100, height: 100 });
  });
});

describe("scaleIterationCacheAroundPoint", () => {
  it("rectの外の点を中心に動かすパターン、複数の点", () => {
    const itrs: IterationBuffer[] = [
      {
        rect: { x: 0, y: 0, width: 50, height: 50 },
        buffer: new Uint32Array(1),
        resolution: { width: 50, height: 50 },
      },
      {
        rect: { x: 50, y: 0, width: 50, height: 50 },
        buffer: new Uint32Array(1),
        resolution: { width: 50, height: 50 },
      },
      {
        rect: { x: 0, y: 50, width: 50, height: 50 },
        buffer: new Uint32Array(1),
        resolution: { width: 50, height: 50 },
      },
      {
        rect: { x: 50, y: 50, width: 50, height: 50 },
        buffer: new Uint32Array(1),
        resolution: { width: 50, height: 50 },
      },
    ];

    const result = scaleIterationCacheAroundPoint(50, 50, 2.0, 100, 100, itrs);

    expect(result[0].rect).toEqual({
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });
    expect(result[1].rect).toEqual({
      x: 50,
      y: -50,
      width: 100,
      height: 100,
    });
    expect(result[2].rect).toEqual({
      x: -50,
      y: 50,
      width: 100,
      height: 100,
    });
    expect(result[3].rect).toEqual({
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
  });
});

describe("consolidateIterationCache", () => {
  it("縮小リサイズ後のキャッシュを新しいキャンバスサイズに焼き直す", () => {
    // rectだけ800に縮められ、bufferは1024x1024のままという状態
    const buffer = new Uint32Array(1024 * 1024);
    buffer[512 * 1024 + 512] = 7;

    setIterationCache([
      {
        rect: { x: 0, y: 0, width: 800, height: 800 },
        buffer,
        resolution: { width: 1024, height: 1024 },
      },
    ]);

    consolidateIterationCache(800, 800);

    const cache = getIterationCache();
    expect(cache).toHaveLength(1);
    expect(cache[0].rect).toEqual({ x: 0, y: 0, width: 800, height: 800 });
    expect(cache[0].resolution).toEqual({ width: 800, height: 800 });
    expect(cache[0].buffer.length).toBe(800 * 800);
    // ratio 1.28なのでcanvas上の(400, 400)がsource(512, 512)を引く
    expect(cache[0].buffer[400 * 800 + 400]).toBe(7);
  });

  it("既にキャンバス全面の等倍1枚なら焼き直さない", () => {
    const buffer = new Uint32Array(100 * 100);

    setIterationCache([
      {
        rect: { x: 0, y: 0, width: 100, height: 100 },
        buffer,
        resolution: { width: 100, height: 100 },
      },
    ]);

    consolidateIterationCache(100, 100);

    expect(getIterationCache()[0].buffer).toBe(buffer);
  });
});
