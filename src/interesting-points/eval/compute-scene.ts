import { readFileSync } from "node:fs";
import BigNumber from "bignumber.js";
import { initSync as initApfp } from "../../../wasm-fp/pkg/apfp.js";
import {
  alloc_job,
  begin_iteration_job,
  begin_pass,
  bla_bytes_ptr,
  bla_row_offsets_ptr,
  calc_iteration_band,
  initSync as initIter,
  scaled_iterations_ptr,
  xn_ptr,
} from "../../../wasm-iter/pkg/mandelbrot_iter.js";
import { calcRequiredLimbs } from "../../math/calc-required-limbs";
import { complexArbitary, pixelToComplexCoordinateComplexArbitrary } from "../../math/complex";
import {
  BLATableView,
  encodeBlaTableItems,
  SKIP_BLA_ENTRY_UNTIL_THIS_L,
} from "../../workers/bla-table-item";
import { calcBLACoefficient, calcRefOrbitWasm } from "../../workers/ref-orbit-core";

/** 評価用シーンの定義。座標文字列はアプリのURLパラメータと同じ形式 */
export interface Scene {
  name: string;
  x: string;
  y: string;
  r: string;
  N: number;
  width: number;
  height: number;
}

let iterMemory: WebAssembly.Memory | null = null;

/**
 * wasm-fp / wasm-iter を node 上で同期初期化する。複数回呼んでも2回目以降は何もしない
 */
export const initWasmForNode = (): void => {
  if (iterMemory !== null) return;
  const wasmDir = new URL("../../../public/wasm/", import.meta.url);
  initApfp({ module: readFileSync(new URL("apfp_bg.wasm", wasmDir)) });
  iterMemory = initIter({
    module: readFileSync(new URL("mandelbrot_iter_bg.wasm", wasmDir)),
  }).memory;
};

/**
 * シーンの iteration buffer を perturbation 方式で計算する（ブラウザ不要）。
 *
 * ref orbit → BLA table → wasm-iter の1 pass 計算、という worker と同じ手順を単スレッドで実行する。
 */
export const computeScene = (scene: Scene): Uint32Array => {
  initWasmForNode();
  const memory = iterMemory!;
  const { width, height, N } = scene;

  const refPixelX = Math.floor(width / 2);
  const refPixelY = Math.floor(height / 2);
  const center = complexArbitary(scene.x, scene.y);
  const radius = new BigNumber(scene.r);
  const ref = pixelToComplexCoordinateComplexArbitrary(
    refPixelX,
    refPixelY,
    center,
    radius,
    width,
    height,
  );
  const limbs = calcRequiredLimbs(ref.re.toFixed(), ref.im.toFixed(), N);
  const xn = calcRefOrbitWasm(ref, N, limbs);
  const refLen = xn.length / 2;
  const pixelSpacing = radius.toNumber() / Math.max(width, height);
  const blaBuffer = encodeBlaTableItems(calcBLACoefficient(xn, refLen, pixelSpacing));
  const blaView = new BLATableView(blaBuffer);

  const pixelNum = width * height;
  alloc_job(xn.length, blaBuffer.byteLength, blaView.rowOffsets.length, pixelNum, pixelNum);
  new Float64Array(memory.buffer, xn_ptr(), xn.length).set(xn);
  new Uint8Array(memory.buffer, bla_bytes_ptr(), blaBuffer.byteLength).set(
    new Uint8Array(blaBuffer),
  );
  new Int32Array(memory.buffer, bla_row_offsets_ptr(), blaView.rowOffsets.length).set(
    blaView.rowOffsets,
  );

  const deltaCScale = (2 * radius.toNumber()) / Math.min(width, height);
  const startBLAIndex = Math.floor(Math.log2(SKIP_BLA_ENTRY_UNTIL_THIS_L)) + 1;
  begin_iteration_job(
    N,
    refLen - 1,
    blaView.length,
    startBLAIndex,
    deltaCScale,
    refPixelX,
    refPixelY,
    width,
    height,
    0,
    0,
  );
  begin_pass(1, 1, width, false, true);
  calc_iteration_band(0, height);

  return new Uint32Array(memory.buffer, scaled_iterations_ptr(), pixelNum).slice();
};
