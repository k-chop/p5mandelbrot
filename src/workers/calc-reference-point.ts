/// <reference lib="webworker" />

import BigNumber from "bignumber.js";
import {
  Complex,
  ComplexArbitrary,
  complexArbitary,
  dAdd,
  dMul,
  dNorm,
  dReduce,
  dSquare,
  toComplex,
} from "../math";
import { ReferencePointCalculationWorkerParams } from "../types";
import { pixelToComplexCoordinate } from "../math/complex-plane";

/**
 * Reference Pointを選んで
 * 計算したXn, Xn2, |Xn * ε|を返す
 */

export type ReferencePointContext = {
  xn: Complex[];
  xn2: Complex[];
};

function calcReferencePoint(
  center: ComplexArbitrary,
  maxIteration: number,
): ReferencePointContext {
  const xn: Complex[] = [];
  const xn2: Complex[] = [];

  let z = complexArbitary(0.0, 0.0);

  let n = 0;

  while (n <= maxIteration && dNorm(z).lt(4.0)) {
    xn.push(toComplex(z));
    xn2.push(toComplex(dMul(z, 2)));

    z = dReduce(dAdd(dSquare(z), center));

    n++;
  }

  return { xn, xn2 };
}

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

  const { xn, xn2 } = calcReferencePoint(referencePoint, maxIteration);

  self.postMessage({ type: "result", xn, xn2 });
});
