/// <reference lib="webworker" />

import BigNumber from "bignumber.js";
import {
  BLATableItem,
  Complex,
  ComplexArbitrary,
  add,
  complex,
  complexArbitary,
  dAdd,
  dNorm,
  dReduce,
  dSquare,
  mul,
  mulN,
  norm,
  toComplex,
} from "../math";
import { pixelToComplexCoordinateComplexArbitrary } from "../math/complex-plane";
import { RefOrbitWorkerParams, XnBuffer, BLATableBuffer } from "../types";
import { encodeComplexArray } from "@/lib/xn-buffer";
import { encodeBlaTableItems } from "@/lib/bla-table-item-buffer";

export type RefOrbitContext = {
  xn: XnBuffer;
  blaTable: BLATableBuffer;
  elapsed: number;
};

export type RefOrbitContextPopulated = {
  xn: Complex[];
  blaTable: BLATableItem[][];
};

function calcRefOrbit(
  center: ComplexArbitrary,
  maxIteration: number,
  terminateChecker: Uint8Array,
  workerIdx: number,
): { xn: Complex[] } {
  // [re_0, im_0, re_1, im_1, ...]
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
    return { xn: [] };
  }

  const xn: Complex[] = [];

  // FIXME: 後ほどFloat64Arrayのまま返すように変更する
  for (let i = 0; i < n; i++) {
    xn.push({ re: xnn[i * 2], im: xnn[i * 2 + 1] });
  }

  return { xn };
}

/**
 * 計算済みのReference OrbitからBLAの係数を計算する
 */
function calcBLACoefficient(ref: Complex[], pixelSpacing: number) {
  // Reference: https://mathr.co.uk/tmp/mandelbla.pdf

  const blaTable: BLATableItem[][] = [];

  const eps = 0.0001;

  blaTable[0] = Array.from({ length: ref.length - 1 });
  for (let i = 1; i < ref.length; i++) {
    const z_m = ref[i];
    const a = mulN(z_m, 2.0);
    const b = complex(1.0, 0.0);

    const absA = Math.sqrt(norm(a));
    const r = Math.max(0, (eps * absA - pixelSpacing) / (absA + 1));
    blaTable[0][i - 1] = { a, b, r, l: 1 };
  }

  const max = Math.floor(Math.log2(ref.length));

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
        const r = Math.min(
          x.r,
          Math.max(0, (y.r - absXB * pixelSpacing) / absXA),
        );
        blaTable[d + 1][j] = { a, b, r, l: x.l + y.l };
      } else {
        blaTable[d + 1][j] = blaTable[d][jx];
      }
    }
    if (blaTable[d + 1].length === 1) break;
  }

  console.debug("blaTable", blaTable);

  return blaTable;
}

async function setup() {
  // init here in future

  self.postMessage({ type: "init" });

  self.addEventListener("message", (event) => {
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
    } = event.data as RefOrbitWorkerParams;

    const startedAt = performance.now();
    console.debug(`${jobId}: start (ref)`);

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

    const { xn } = calcRefOrbit(
      referencePoint,
      maxIteration,
      terminateChecker,
      workerIdx,
    );

    if (terminateChecker[workerIdx] !== 0) {
      console.debug(`${jobId}: terminated (ref)`);
      self.postMessage({
        type: "terminated",
      });
      return;
    }

    const pixelSpacing = radius.toNumber() / Math.max(pixelWidth, pixelHeight);
    const blaTable = calcBLACoefficient(xn, pixelSpacing);

    const xnConverted = encodeComplexArray(xn);
    const blaTableConverted = encodeBlaTableItems(blaTable);

    const elapsed = performance.now() - startedAt;

    self.postMessage({
      type: "result",
      xn: xnConverted,
      blaTable: blaTableConverted,
      elapsed,
    });

    console.debug(`${jobId}: completed (ref)`);
  });
}

setup();
