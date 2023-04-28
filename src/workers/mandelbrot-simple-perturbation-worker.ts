/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import BigNumber from "bignumber.js";
import {
  Complex,
  ComplexArbitrary,
  PRECISION,
  complexArbitary,
  dAdd,
  dMul,
  dReduce,
  dSquare,
  dSub,
  mulIm,
  mulRe,
  nNorm,
  norm,
  toComplex,
} from "../math";
import { WorkerParams } from "../types";

type CalculationContext = {
  xn: Complex[];
  xn2: Complex[];
  glitchChecker: number[];
};

let lastOutput: unknown;
let count = 0;
function logDebounce(a: unknown) {
  if (a !== lastOutput && count < 200) {
    console.log(a);
    lastOutput = a;
    count++;
  }
}

function calcReferencePoint(
  center: ComplexArbitrary,
  maxIteration: number
): CalculationContext {
  const e = 1.0e-6;

  const xn: Complex[] = [];
  const xn2: Complex[] = [];
  const glitchChecker: number[] = [];

  let z = complexArbitary(0.0, 0.0);

  for (let i = 0; i <= maxIteration; i++) {
    xn.push(toComplex(z));
    xn2.push(toComplex(dMul(z, 2)));
    glitchChecker.push(norm(toComplex(dMul(z, e))));

    z = dReduce(dAdd(dSquare(z), center));
  }

  return { xn, xn2, glitchChecker };
}

function pixelToComplexCoordinate(
  pixelX: number,
  pixelY: number,
  c: ComplexArbitrary,
  r: BigNumber,
  pixelWidth: number,
  pixelHeight: number
): ComplexArbitrary {
  return {
    re: c.re.plus(
      new BigNumber(pixelX)
        .times(2)
        .div(pixelWidth)
        .minus(1)
        .times(r)
        .sd(PRECISION)
    ),
    im: c.im.minus(
      new BigNumber(pixelY)
        .times(2)
        .div(pixelHeight)
        .minus(1)
        .times(r)
        .sd(PRECISION)
    ),
  };
}

self.addEventListener("message", (event) => {
  const {
    pixelHeight,
    pixelWidth,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    N,
    startX,
    endX,
    startY,
    endY,
  } = event.data as WorkerParams;

  const iterations = new Uint32Array((endY - startY) * (endX - startX));

  const c = complexArbitary(cxStr, cyStr);
  const r = new BigNumber(rStr);

  function calcIterationAt(
    pixelX: number,
    pixelY: number,
    context: CalculationContext
  ): number {
    const { xn, xn2, glitchChecker } = context;
    // Δn
    let deltaNRe = 0.0;
    let deltaNIm = 0.0;

    const current = pixelToComplexCoordinate(
      pixelX,
      pixelY,
      c,
      r,
      pixelWidth,
      pixelHeight
    );
    // Δ0
    const deltaC = toComplex(dSub(current, c));

    let n = 0;
    // |Xn + Δn|
    let calcPointNorm = 0.0;
    // |Xn|が4以上なら発散することは証明されているので、たぶん|Xn+Δn|も4以上なら発散する（ほんとか？）
    // 4より大きい値にしてもいい
    const bailout = 4.0;

    while (calcPointNorm < bailout && n < N) {
      // Δn+1 = 2 * Xn * Δn + Δn^2 + Δ0 を計算していく
      const _deltaNRe = deltaNRe;
      const _deltaNIm = deltaNIm;

      // (2 * Xn + Δn) * Δn に展開して計算
      const dzrT = xn2[n].re + _deltaNRe;
      const dziT = xn2[n].im + _deltaNIm;

      deltaNRe = mulRe(dzrT, dziT, _deltaNRe, _deltaNIm) + deltaC.re;
      deltaNIm = mulIm(dzrT, dziT, _deltaNRe, _deltaNIm) + deltaC.im;

      n++;

      // |Xn + Δn| << |Xn|
      // glitchChecker[n]にはXnのnormのε倍が入っているので、
      // それより小さければsignificantly smallerとみなせる
      calcPointNorm = nNorm(xn[n].re + deltaNRe, xn[n].im + deltaNIm);
      if (calcPointNorm < glitchChecker[n]) {
        // glitched
        // TODO: ちゃんと再計算する
        return -1;
      }
    }

    return n;
  }

  // FIXME: （仮）中央をReference PointとしてZnを計算
  const refPixelY = 400;
  const refPixelX = 400;

  const center = pixelToComplexCoordinate(
    refPixelX,
    refPixelY,
    c,
    r,
    pixelWidth,
    pixelHeight
  );
  const context = calcReferencePoint(center, N);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const n = calcIterationAt(x, y, context);

      const index = x - startX + (y - startY) * (endX - startX);
      iterations[index] = n;
    }
    self.postMessage({
      type: "progress",
      progress: (y - startY) / (endY - startY),
    });
  }

  self.postMessage({ type: "result", iterations }, [iterations.buffer]);
});
