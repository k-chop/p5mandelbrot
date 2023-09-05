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
import { pixelToComplexCoordinate } from "../math/complex-plane";
import { ReferencePointCalculationWorkerParams } from "../types";

export type ReferencePointContext = {
  xn: Complex[];
  blaTable: BLATableItem[][];
};

function calcReferencePoint(
  center: ComplexArbitrary,
  maxIteration: number,
): Omit<ReferencePointContext, "blaTable"> {
  const xn: Complex[] = [];

  let z = complexArbitary(0.0, 0.0);

  let n = 0;

  while (n <= maxIteration && dNorm(z).lt(4.0)) {
    xn.push(toComplex(z));

    z = dReduce(dAdd(dSquare(z), center));

    n++;
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
    } = event.data as ReferencePointCalculationWorkerParams;

    // FIXME: 適当な座標
    const refPixelX = 400;
    const refPixelY = 400;

    const center = complexArbitary(complexCenterX, complexCenterY);
    const radius = new BigNumber(radiusStr);

    const referencePoint = pixelToComplexCoordinate(
      refPixelX,
      refPixelY,
      center,
      radius,
      pixelWidth,
      pixelHeight,
    );

    const { xn } = calcReferencePoint(referencePoint, maxIteration);

    const pixelSpacing = radius.toNumber() / Math.max(pixelWidth, pixelHeight);
    const blaTable = calcBLACoefficient(xn, pixelSpacing);

    self.postMessage({ type: "result", xn, blaTable });
  });
}

setup();
