import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { mulIm, mulRe, nNorm } from "../math/complex";
import { BLATableView, ITEM_BYTE_LENGTH } from "./bla-table-item";
import {
  alloc_job,
  begin_iteration_job,
  begin_pass,
  bla_bytes_ptr,
  bla_row_offsets_ptr,
  calc_iteration_band,
  get_hit_count,
  initSync,
  scaled_iterations_ptr,
  xn_ptr,
} from "../../wasm-iter/pkg/mandelbrot_iter.js";

/**
 * wasm版hot loopがJS版と同じ結果を出すことを確認する差分テスト。
 *
 * BLATableの中身は数学的に正しい必要がない。両実装がまったく同じ演算を同じ順序で行う以上、
 * 入力が同じなら出力もbit単位で一致するはずで、それを確認するのがこのテストの目的。
 */

/** JS版の実装と揃える (perturbation workerのstartBLAIndexと同じ値) */
const START_BLA_INDEX = 2;
const BAILOUT_RADIUS = 4.0;

let wasmMemory: WebAssembly.Memory;

type TestJob = {
  xn: Float64Array;
  blaTableView: BLATableView;
  blaBuffer: SharedArrayBuffer;
  maxIteration: number;
  deltaCScale: number;
  refPixelX: number;
  refPixelY: number;
  areaWidth: number;
  areaHeight: number;
  startX: number;
  startY: number;
};

/** 決定的な疑似乱数生成器 (mulberry32) */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** c を中心とした reference orbit を double で計算して [re, im, ...] で返す */
function createXn(cRe: number, cIm: number, length: number): Float64Array {
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
}

/**
 * テスト用のBLATableバイト列を作る。
 * 行dの要素数は refIteration の取りうる最大値を d bit 右シフトした値をカバーできる大きさにする
 */
function createBlaTable(
  rowCount: number,
  maxRefIteration: number,
  seed: number,
): SharedArrayBuffer {
  const random = createRandom(seed);
  const rowLengths: number[] = [];
  for (let d = 0; d < rowCount; d++) {
    // データ節約のために空にしている行を再現する
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
      // 発散させないよう恒等変換に近い係数にしておく
      view.setFloat64(byteOffset, 1 + (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 8, (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 16, (random() - 0.5) * 0.1, true);
      view.setFloat64(byteOffset + 24, (random() - 0.5) * 0.1, true);
      // r²。BLAが採用されるケースと採用されないケースが両方出るような分布にする
      view.setFloat64(byteOffset + 32, 10 ** (-8 * random()), true);
      view.setInt32(byteOffset + 40, 1 << d, true);
      byteOffset += ITEM_BYTE_LENGTH;
    }
  }

  return buffer;
}

/**
 * JS版のcalcIterationAt。移植元の実装をそのまま持ってきたもので、
 * wasm版の出力を突き合わせる基準として使う
 */
function calcIterationAtReference(job: TestJob, pixelX: number, pixelY: number): number {
  const { xn, blaTableView, maxIteration } = job;
  const maxRefIteration = xn.length / 2 - 1;
  const blaRows = blaTableView.length;
  const blaView = blaTableView.view;
  const rowOffsets = blaTableView.rowOffsets;

  let deltaNRe = 0.0;
  let deltaNIm = 0.0;

  const deltaCRe = (pixelX - job.refPixelX) * job.deltaCScale;
  const deltaCIm = -(pixelY - job.refPixelY) * job.deltaCScale;

  let iteration = 0;
  let refIteration = 0;

  while (iteration < maxIteration) {
    const refIdx2 = refIteration * 2;
    const xRe = xn[refIdx2];
    const xIm = xn[refIdx2 + 1];
    const zRe = xRe + deltaNRe;
    const zIm = xIm + deltaNIm;
    const zNorm = nNorm(zRe, zIm);
    if (zNorm > BAILOUT_RADIUS) break;

    const dzNorm = nNorm(deltaNRe, deltaNIm);
    let curXRe = xRe;
    let curXIm = xIm;
    if (zNorm < dzNorm || refIteration === maxRefIteration) {
      deltaNRe = zRe;
      deltaNIm = zIm;
      refIteration = 0;
      curXRe = xn[0];
      curXIm = xn[1];
    }

    let blaRowIdx = -1;
    let blaColumnIdx = -1;

    if (0 < refIteration) {
      const refM1 = refIteration - 1;
      const ctz = refM1 === 0 ? 32 : 31 - Math.clz32(refM1 & -refM1);
      const maxD = ctz < blaRows ? ctz : blaRows - 1;
      for (let d = START_BLA_INDEX; d <= maxD; d++) {
        const jIdx = refM1 >> d;
        const byteOffset = rowOffsets[d * 2] + jIdx * ITEM_BYTE_LENGTH;
        const rSq = blaView.getFloat64(byteOffset + 32, true);

        if (dzNorm < rSq) {
          blaRowIdx = d;
          blaColumnIdx = jIdx;
        } else {
          break;
        }
      }
    }

    const hasBLA = blaRowIdx >= 0;

    let skipped = 0;
    let blaByteOffset = 0;
    if (hasBLA) {
      blaByteOffset = rowOffsets[blaRowIdx * 2] + blaColumnIdx * ITEM_BYTE_LENGTH;
      skipped = blaView.getInt32(blaByteOffset + 40, true);
    }
    const n = refIteration + skipped;

    if (hasBLA && n < maxRefIteration) {
      const aRe = blaView.getFloat64(blaByteOffset, true);
      const aIm = blaView.getFloat64(blaByteOffset + 8, true);
      const bRe = blaView.getFloat64(blaByteOffset + 16, true);
      const bIm = blaView.getFloat64(blaByteOffset + 24, true);

      const dzRe = mulRe(aRe, aIm, deltaNRe, deltaNIm) + mulRe(bRe, bIm, deltaCRe, deltaCIm);
      const dzIm = mulIm(aRe, aIm, deltaNRe, deltaNIm) + mulIm(bRe, bIm, deltaCRe, deltaCIm);

      deltaNRe = dzRe;
      deltaNIm = dzIm;

      refIteration += skipped;
      iteration += skipped;
    } else {
      const prevRe = deltaNRe;
      const prevIm = deltaNIm;

      const dzrT = curXRe * 2 + prevRe;
      const dziT = curXIm * 2 + prevIm;

      deltaNRe = mulRe(dzrT, dziT, prevRe, prevIm) + deltaCRe;
      deltaNIm = mulIm(dzrT, dziT, prevRe, prevIm) + deltaCIm;

      refIteration++;
      iteration++;
    }
  }

  return Math.min(iteration, maxIteration);
}

/** JS版の1 pass分のループ。移植元と同じくxをxDiff刻みで進める */
function runPassReference(
  job: TestJob,
  xDiff: number,
  yDiff: number,
  isSuperSampling: boolean,
  iterationsCache: Uint32Array,
): { scaledIterations: Uint32Array; hitCount: number } {
  const { areaWidth, areaHeight, startX, startY, maxIteration } = job;
  const scaledAreaWidth = Math.floor(areaWidth / xDiff);
  const scaledAreaHeight = Math.floor(areaHeight / yDiff);
  const scaledIterations = new Uint32Array(scaledAreaWidth * scaledAreaHeight);
  let hitCount = 0;

  let scaledY = 0;
  for (let y = startY; y < startY + areaHeight; y = y + yDiff, scaledY++) {
    let scaledX = 0;
    for (let x = startX; x < startX + areaWidth; x = x + xDiff, scaledX++) {
      const index = Math.floor(x - startX + (y - startY) * areaWidth);
      const scaledIndex = scaledX + scaledY * scaledAreaWidth;

      if (!isSuperSampling) {
        const cached = iterationsCache[index];
        if (cached !== 0) {
          scaledIterations[scaledIndex] = cached;
          if (cached === maxIteration) hitCount++;
          continue;
        }
      }

      const n = calcIterationAtReference(job, x, y);
      if (!isSuperSampling) iterationsCache[index] = n;
      scaledIterations[scaledIndex] = n;
      if (n === maxIteration) hitCount++;
    }
  }

  return { scaledIterations, hitCount };
}

/** wasm側にjobの入力をコピーしてパラメータを確定する */
function setupWasmJob(job: TestJob, isSuperSampling: boolean, maxScaledPixels: number) {
  const rowOffsetsLength = job.blaTableView.rowOffsets.length;
  const areaPixels = job.areaWidth * job.areaHeight;

  alloc_job(
    job.xn.length,
    job.blaBuffer.byteLength,
    rowOffsetsLength,
    isSuperSampling ? 0 : areaPixels,
    maxScaledPixels,
  );

  new Float64Array(wasmMemory.buffer, xn_ptr(), job.xn.length).set(job.xn);
  new Uint8Array(wasmMemory.buffer, bla_bytes_ptr(), job.blaBuffer.byteLength).set(
    new Uint8Array(job.blaBuffer),
  );
  new Int32Array(wasmMemory.buffer, bla_row_offsets_ptr(), rowOffsetsLength).set(
    job.blaTableView.rowOffsets,
  );

  begin_iteration_job(
    job.maxIteration,
    job.xn.length / 2 - 1,
    job.blaTableView.length,
    START_BLA_INDEX,
    job.deltaCScale,
    job.refPixelX,
    job.refPixelY,
    job.areaWidth,
    job.areaHeight,
    job.startX,
    job.startY,
  );
}

/** wasm側で1 pass走らせて結果を取り出す */
function runPassWasm(
  job: TestJob,
  xDiff: number,
  yDiff: number,
  isSuperSampling: boolean,
  isResultPass: boolean,
): { scaledIterations: Uint32Array; hitCount: number } {
  const scaledAreaWidth = Math.floor(job.areaWidth / xDiff);
  const scaledAreaHeight = Math.floor(job.areaHeight / yDiff);

  begin_pass(xDiff, yDiff, scaledAreaWidth, isSuperSampling, isResultPass);
  calc_iteration_band(0, scaledAreaHeight);

  const scaledPixels = scaledAreaWidth * scaledAreaHeight;
  const scaledIterations = new Uint32Array(scaledPixels);
  scaledIterations.set(new Uint32Array(wasmMemory.buffer, scaled_iterations_ptr(), scaledPixels));

  return { scaledIterations, hitCount: get_hit_count() };
}

/** テスト用のjobを1つ組み立てる */
function createTestJob(maxIteration: number, areaWidth: number, areaHeight: number): TestJob {
  const xn = createXn(-0.7451, 0.11302, 512);
  const blaBuffer = createBlaTable(12, xn.length / 2 - 1, 12345);

  return {
    xn,
    blaBuffer,
    blaTableView: new BLATableView(blaBuffer),
    maxIteration,
    deltaCScale: 5e-4,
    refPixelX: areaWidth / 2,
    refPixelY: areaHeight / 2,
    areaWidth,
    areaHeight,
    startX: 0,
    startY: 0,
  };
}

beforeAll(() => {
  const wasmPath = new URL("../../public/wasm/mandelbrot_iter_bg.wasm", import.meta.url);
  const output = initSync({ module: readFileSync(wasmPath) });
  wasmMemory = output.memory;
});

describe("wasm iteration worker", () => {
  it("最終pass (xDiff=1) の結果がJS版と一致する", () => {
    const job = createTestJob(2000, 64, 48);

    setupWasmJob(job, false, job.areaWidth * job.areaHeight);
    const actual = runPassWasm(job, 1, 1, false, true);

    const expected = runPassReference(
      job,
      1,
      1,
      false,
      new Uint32Array(job.areaWidth * job.areaHeight),
    );

    expect(Array.from(actual.scaledIterations)).toEqual(Array.from(expected.scaledIterations));
    expect(actual.hitCount).toBe(expected.hitCount);
    // 全ピクセルが同じ値だと一致していても意味がないので、値がばらけていることを確認しておく
    expect(new Set(expected.scaledIterations).size).toBeGreaterThan(10);
  });

  it("supersampling (xDiff=0.5) の結果がJS版と一致する", () => {
    const job = createTestJob(1500, 32, 24);
    const scaledPixels = job.areaWidth * 2 * (job.areaHeight * 2);

    setupWasmJob(job, true, scaledPixels);
    const actual = runPassWasm(job, 0.5, 0.5, true, true);

    const expected = runPassReference(
      job,
      0.5,
      0.5,
      true,
      new Uint32Array(job.areaWidth * job.areaHeight),
    );

    expect(Array.from(actual.scaledIterations)).toEqual(Array.from(expected.scaledIterations));
    expect(actual.hitCount).toBe(expected.hitCount);
  });

  it("低解像度passを挟んでも最終passの結果は単独実行と一致する", () => {
    const job = createTestJob(2000, 64, 48);
    const areaPixels = job.areaWidth * job.areaHeight;

    setupWasmJob(job, false, areaPixels);
    for (const diff of [8, 4, 2]) {
      runPassWasm(job, diff, diff, false, false);
    }
    const withLowRes = runPassWasm(job, 1, 1, false, true);

    setupWasmJob(job, false, areaPixels);
    const standalone = runPassWasm(job, 1, 1, false, true);

    expect(Array.from(withLowRes.scaledIterations)).toEqual(
      Array.from(standalone.scaledIterations),
    );
    expect(withLowRes.hitCount).toBe(standalone.hitCount);
  });

  it("hitCountがmaxIterationに達したピクセル数と一致する", () => {
    const job = createTestJob(300, 48, 32);

    setupWasmJob(job, false, job.areaWidth * job.areaHeight);
    const { scaledIterations, hitCount } = runPassWasm(job, 1, 1, false, true);

    const counted = scaledIterations.reduce(
      (acc, n) => (n === job.maxIteration ? acc + 1 : acc),
      0,
    );

    expect(hitCount).toBe(counted);
    expect(hitCount).toBeGreaterThan(0);
    expect(hitCount).toBeLessThan(scaledIterations.length);
  });

  it("result passでないpassではhitCountを数えない", () => {
    const job = createTestJob(300, 48, 32);

    setupWasmJob(job, false, job.areaWidth * job.areaHeight);
    const { hitCount } = runPassWasm(job, 1, 1, false, false);

    expect(hitCount).toBe(0);
  });
});
