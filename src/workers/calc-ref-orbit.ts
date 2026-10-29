/// <reference lib="webworker" />

import { encodeBlaTableItems, type BLATableView } from "./bla-table-item";
import type { ComplexArrayView } from "./xn-buffer";
import { encodeFloat64AsXnBuffer } from "./xn-buffer";
import BigNumber from "bignumber.js";
import wasmInit from "../../wasm-fp/pkg/apfp.js";
import { calcBLACoefficient, calcRefOrbitWasm } from "./ref-orbit-core";
import { calcRequiredLimbs, clampLimbs } from "../math/calc-required-limbs";
import type { ComplexArbitrary } from "../math/complex";
import {
  complexArbitary,
  dAdd,
  dNorm,
  dReduce,
  dSquare,
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
 * wasm モジュールを初期化する
 */
async function initWasm() {
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const wasmUrl = new URL(`${base}wasm/apfp_bg.wasm`, self.location.origin);
    await wasmInit({ module_or_path: wasmUrl });
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
