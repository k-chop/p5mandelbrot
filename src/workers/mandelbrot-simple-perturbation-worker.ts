/// <reference lib="webworker" />

import BigNumber from "bignumber.js";
import { complexArbitary, dSub, mulIm, mulRe, nNorm, toComplex } from "../math";
import { pixelToComplexCoordinate } from "../math/complex-plane";
import { MandelbrotCalculationWorkerParams } from "../types";
import { ReferencePointContext } from "./calc-reference-point";

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
    xn,
    xn2,
    glitchChecker,
  } = event.data as MandelbrotCalculationWorkerParams;

  const iterations = new Uint32Array((endY - startY) * (endX - startX));

  const c = complexArbitary(cxStr, cyStr);
  const r = new BigNumber(rStr);

  function calcIterationAt(
    pixelX: number,
    pixelY: number,
    context: ReferencePointContext
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

  const context = { xn, xn2, glitchChecker };

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
