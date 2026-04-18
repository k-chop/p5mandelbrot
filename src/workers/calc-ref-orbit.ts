/// <reference lib="webworker" />

import {
  encodeBlaTableItems,
  SKIP_BLA_ENTRY_UNTIL_THIS_L,
  type BLATableItem,
  type BLATableView,
} from "@/workers/bla-table-item";
import type { ComplexArrayView } from "@/workers/xn-buffer";
import { encodeFloat64AsXnBuffer } from "@/workers/xn-buffer";
import BigNumber from "bignumber.js";
import wasmInit, { calculate as wasmCalculate } from "../../wasm-fp/pkg/apfp.js";
import { calcRequiredLimbs, clampLimbs } from "../math/calc-required-limbs";
import type { ComplexArbitrary } from "../math/complex";
import {
  add,
  complexArbitary,
  dAdd,
  dNorm,
  dReduce,
  dSquare,
  mul,
  norm,
  pixelToComplexCoordinateComplexArbitrary,
  toComplex,
} from "../math/complex";
import type { BLATableBuffer, RefOrbitWorkerParams, XnBuffer } from "../types";

export type RefOrbitContext = {
  xn: XnBuffer;
  blaTable: BLATableBuffer;
  elapsed: number;
};

export type RefOrbitContextPopulated = {
  xnView: ComplexArrayView;
  blaTableView: BLATableView;
};

let wasmReady = false;

/**
 * wasm (固定精度 big float) で reference orbit を計算する。
 * limb 数は呼び出し側で必ず決定して渡すこと。
 *
 * 戻り値は [re_0, im_0, re_1, im_1, ...] レイアウトのFloat64Array
 */
function calcRefOrbitWasm(
  referencePoint: ComplexArbitrary,
  maxIteration: number,
  limbCount: number,
): Float64Array {
  const orbit = wasmCalculate({
    type: "reference_orbit",
    x: referencePoint.re.toFixed(),
    y: referencePoint.im.toFixed(),
    max_iter: maxIteration,
    active_limbs: limbCount,
  });
  return orbit;
}

/**
 * BigNumberベースの JS フォールバックで reference orbit を計算する
 *
 * 戻り値は [re_0, im_0, re_1, im_1, ...] レイアウトのFloat64Array (実要素分にtrim済み)。
 * 中断された場合は空のFloat64Array。
 */
function calcRefOrbit(
  center: ComplexArbitrary,
  maxIteration: number,
  terminateChecker: Uint8Array,
  workerIdx: number,
): Float64Array {
  const xnn = new Float64Array(maxIteration * 2);

  let z = complexArbitary(0.0, 0.0);
  let n = 0;

  const reportTiming = Math.floor(maxIteration / 100);

  while (n <= maxIteration && dNorm(z).lt(4.0)) {
    const { re, im } = toComplex(z);
    xnn[n * 2] = re;
    xnn[n * 2 + 1] = im;

    z = dReduce(dAdd(dSquare(z), center));

    n++;

    if (n % reportTiming === 0) {
      self.postMessage({
        type: "progress",
        progress: n,
      });
    }
    if (terminateChecker[workerIdx] !== 0) break;
  }

  // 中断された
  if (terminateChecker[workerIdx] !== 0) {
    return new Float64Array(0);
  }

  return xnn.slice(0, n * 2);
}

/**
 * 計算済みのReference OrbitからBLAの係数を計算する
 *
 * xn は [re_0, im_0, ...] レイアウトのFloat64Array。refLen = xn.length / 2。
 */
function calcBLACoefficient(xn: Float64Array, refLen: number, pixelSpacing: number) {
  // Reference: https://mathr.co.uk/tmp/mandelbla.pdf

  const blaTable: BLATableItem[][] = [];

  const eps = 0.0001;

  blaTable[0] = Array.from({ length: refLen - 1 });
  for (let i = 1; i < refLen; i++) {
    const zRe = xn[i * 2];
    const zIm = xn[i * 2 + 1];
    const aRe = zRe * 2;
    const aIm = zIm * 2;
    const a = { re: aRe, im: aIm };
    const b = { re: 1.0, im: 0.0 };

    const absA = Math.sqrt(aRe * aRe + aIm * aIm);
    const r = Math.max(0, (eps * absA - pixelSpacing) / (absA + 1));
    blaTable[0][i - 1] = { a, b, r, l: 1 };
  }

  const max = Math.floor(Math.log2(refLen));

  for (let d = 0; d <= max; d++) {
    const nextTableLength = Math.floor((blaTable[d].length + 1) / 2);
    blaTable[d + 1] = Array.from({ length: nextTableLength });

    for (let j = 0; j < nextTableLength; j++) {
      const jx = j * 2;
      const jy = jx + 1;

      if (jy < blaTable[d].length) {
        const x = blaTable[d][jx];
        const y = blaTable[d][jy];

        const a = mul(y.a, x.a);
        const b = add(mul(y.a, x.b), y.b);
        const absXA = Math.sqrt(norm(x.a));
        const absXB = Math.sqrt(norm(x.b));
        const r = Math.min(x.r, Math.max(0, (y.r - absXB * pixelSpacing) / absXA));
        blaTable[d + 1][j] = { a, b, r, l: x.l + y.l };
      } else {
        blaTable[d + 1][j] = blaTable[d][jx];
      }
    }
    if (blaTable[d + 1].length === 1) break;
  }

  // スキップ量が少なくデータ量が多いエントリを抜いておく
  for (let idx = 0; idx <= Math.log2(SKIP_BLA_ENTRY_UNTIL_THIS_L); idx++) {
    blaTable[idx] = [];
  }

  // console.debug("blaTable", blaTable);

  return blaTable;
}

/**
 * wasm モジュールを初期化する
 */
async function initWasm() {
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const wasmUrl = new URL(`${base}wasm/apfp_bg.wasm`, self.location.origin);
    await wasmInit(wasmUrl);
    wasmReady = true;
    console.log("Wasm module initialized");
  } catch (e) {
    console.warn("Failed to init wasm module:", e);
    wasmReady = false;
  }
}

/**
 * worker起動時に呼ばれる
 */
async function setup() {
  await initWasm();

  self.postMessage({ type: "init" });

  self.addEventListener("message", async (event) => {
    if (event.data.type === "calc-reference-orbit") {
      const {
        complexCenterX,
        complexCenterY,
        pixelHeight,
        pixelWidth,
        complexRadius: radiusStr,
        maxIteration,
        jobId,
        terminator,
        workerIdx,
        useWasm,
        limbCountOverride,
      } = event.data as RefOrbitWorkerParams;

      const startedAt = performance.now();
      // console.debug(`${jobId}: start (ref)`);

      const terminateChecker = new Uint8Array(terminator);

      // 適当に中央のピクセルを参照点とする
      const refPixelX = Math.floor(pixelWidth / 2);
      const refPixelY = Math.floor(pixelHeight / 2);

      const center = complexArbitary(complexCenterX, complexCenterY);
      const radius = new BigNumber(radiusStr);

      const referencePoint = pixelToComplexCoordinateComplexArbitrary(
        refPixelX,
        refPixelY,
        center,
        radius,
        pixelWidth,
        pixelHeight,
      );

      let xn: Float64Array = new Float64Array(0);

      // 1. wasm (固定精度 big float)
      if (useWasm && wasmReady) {
        try {
          // 実際に wasm に渡す座標文字列から limb 数を決定する
          const refXStr = referencePoint.re.toFixed();
          const refYStr = referencePoint.im.toFixed();
          const limbCount =
            limbCountOverride != null
              ? clampLimbs(limbCountOverride)
              : calcRequiredLimbs(refXStr, refYStr, maxIteration);

          xn = calcRefOrbitWasm(referencePoint, maxIteration, limbCount);
          console.debug(`${jobId}: ref orbit calculated with wasm (limbs=${limbCount})`);
        } catch (e) {
          console.warn("Failed to calculate refOrbit with wasm. Fallback.", e);
        }
      }

      // 2. ローカルJS (BigNumber)
      if (xn.length === 0) {
        xn = calcRefOrbit(referencePoint, maxIteration, terminateChecker, workerIdx);
        if (xn.length > 0) {
          console.debug(`${jobId}: ref orbit calculated with JS (BigNumber)`);
        }
      }

      if (terminateChecker[workerIdx] !== 0) {
        console.debug(`${jobId}: terminated (ref)`);
        self.postMessage({
          type: "terminated",
        });
        return;
      }

      const refLen = xn.length / 2;
      const pixelSpacing = radius.toNumber() / Math.max(pixelWidth, pixelHeight);
      const blaTable = calcBLACoefficient(xn, refLen, pixelSpacing);

      const xnConverted = encodeFloat64AsXnBuffer(xn);
      const blaTableConverted = encodeBlaTableItems(blaTable);

      const elapsed = performance.now() - startedAt;

      self.postMessage({
        type: "result",
        xn: xnConverted,
        blaTable: blaTableConverted,
        elapsed,
      });

      // console.debug(`${jobId}: completed (ref)`);
    } else if (event.data.type === "request-shutdown") {
      console.log("Shutdown requested");
      self.postMessage({ type: "shutdown" });
    } else {
      console.error("Unknown message", event.data);
    }
  });
}

void setup();
