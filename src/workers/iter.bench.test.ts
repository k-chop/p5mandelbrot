import { readFileSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { BLATableView, ITEM_BYTE_LENGTH } from "./bla-table-item";
import {
  alloc_job,
  begin_iteration_job,
  begin_pass,
  bla_bytes_ptr,
  bla_row_offsets_ptr,
  calc_iteration_band,
  initSync,
  scaled_iterations_ptr,
  xn_ptr,
} from "../../wasm-iter/pkg/mandelbrot_iter.js";

/**
 * wasm-iter の hot loop の速度を測るローカル用ベンチ。
 *
 * target-feature を変えたときの差をブラウザ往復せずに見るためのもの。
 * セットアップは `mandelbrot-iteration-wasm.test.ts` と同じ作りで、
 * BLATable の中身は数学的に正しくなくてよい (経路が現実的に散ればよい)。
 *
 * 実行: `pnpm test iter-bench --run`
 */

const START_BLA_INDEX = 2;
const OUT = "tmp/iter-bench.txt";

let wasmMemory: WebAssembly.Memory;

/** 決定的な疑似乱数生成器 (mulberry32) */
const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** c を中心とした reference orbit を double で計算して [re, im, ...] で返す */
const createXn = (cRe: number, cIm: number, length: number): Float64Array => {
  const xn = new Float64Array(length * 2);
  let zRe = 0;
  let zIm = 0;
  for (let i = 0; i < length; i++) {
    xn[i * 2] = zRe;
    xn[i * 2 + 1] = zIm;
    const nextRe = zRe * zRe - zIm * zIm + cRe;
    zIm = 2 * zRe * zIm + cIm;
    zRe = nextRe;
  }
  return xn;
};

/** ベンチ用のBLATableバイト列を作る */
const createBlaTable = (
  rowCount: number,
  maxRefIteration: number,
  seed: number,
): SharedArrayBuffer => {
  const random = createRandom(seed);
  const rowLengths: number[] = [];
  for (let d = 0; d < rowCount; d++) {
    rowLengths.push(d < START_BLA_INDEX ? 0 : (maxRefIteration >> d) + 2);
  }

  let totalSize = 4;
  for (const rowLength of rowLengths) {
    totalSize += 4 + rowLength * ITEM_BYTE_LENGTH;
  }

  const buffer = new SharedArrayBuffer(totalSize);
  const view = new DataView(buffer);
  view.setInt32(0, rowCount, true);

  let byteOffset = 4;
  for (let d = 0; d < rowCount; d++) {
    view.setInt32(byteOffset, rowLengths[d], true);
    byteOffset += 4;

    for (let j = 0; j < rowLengths[d]; j++) {
      view.setFloat64(byteOffset, 1 + (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 8, (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 16, (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 24, (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 32, 10 ** (-8 * random()), true);
      view.setInt32(byteOffset + 40, 1 << d, true);
      byteOffset += ITEM_BYTE_LENGTH;
    }
  }

  return buffer;
};

const AREA = 512;
const XN_LENGTH = 4096;
const MAX_ITERATION = 4096;
const RUNS = 5;

describe("wasm-iter hot loop bench", () => {
  beforeAll(() => {
    const wasmPath = new URL("../../public/wasm/mandelbrot_iter_bg.wasm", import.meta.url);
    const output = initSync({ module: readFileSync(wasmPath) });
    wasmMemory = output.memory;
  });

  it("1ピクセルあたりのnsを出す", { timeout: 600000 }, () => {
    const xn = createXn(-0.7451, 0.11302, XN_LENGTH);
    const blaBuffer = createBlaTable(12, XN_LENGTH - 1, 12345);
    const blaTableView = new BLATableView(blaBuffer);
    const areaPixels = AREA * AREA;

    alloc_job(
      xn.length,
      blaBuffer.byteLength,
      blaTableView.rowOffsets.length,
      areaPixels,
      areaPixels,
    );
    new Float64Array(wasmMemory.buffer, xn_ptr(), xn.length).set(xn);
    new Uint8Array(wasmMemory.buffer, bla_bytes_ptr(), blaBuffer.byteLength).set(
      new Uint8Array(blaBuffer),
    );
    new Int32Array(wasmMemory.buffer, bla_row_offsets_ptr(), blaTableView.rowOffsets.length).set(
      blaTableView.rowOffsets,
    );

    const samples: number[] = [];
    for (let i = 0; i < RUNS + 2; i++) {
      // 毎回jobを開始し直してiterationsキャッシュをクリアする
      begin_iteration_job(
        MAX_ITERATION,
        xn.length / 2 - 1,
        blaTableView.length,
        START_BLA_INDEX,
        5e-4,
        AREA / 2,
        AREA / 2,
        AREA,
        AREA,
        0,
        0,
      );
      begin_pass(1, 1, AREA, false, true);

      const started = performance.now();
      calc_iteration_band(0, AREA);
      const elapsed = performance.now() - started;

      // 結果を読んで最適化除去を防ぐ
      const out = new Uint32Array(wasmMemory.buffer, scaled_iterations_ptr(), areaPixels);
      if (out[0] === 0xffffffff) throw new Error("unreachable");

      if (i >= 2) samples.push((elapsed * 1e6) / areaPixels);
    }

    expect(samples).toHaveLength(RUNS);

    const best = Math.min(...samples);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    writeFileSync(OUT, `best=${best.toFixed(2)} ns/px  mean=${mean.toFixed(2)} ns/px\n`);
  });
});
