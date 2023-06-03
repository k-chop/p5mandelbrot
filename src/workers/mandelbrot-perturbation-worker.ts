/// <reference lib="webworker" />

import BigNumber from "bignumber.js";
import {
  complexArbitary,
  dSub,
  dividerSequence,
  mulIm,
  mulRe,
  nNorm,
  thin,
  toComplex,
} from "../math";
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
    N: maxIteration,
    startX,
    endX,
    startY,
    endY,
    xn,
    xn2,
  } = event.data as MandelbrotCalculationWorkerParams;

  const pixelNum = (endY - startY) * (endX - startX);
  const iterations = new Uint32Array(pixelNum);

  const c = complexArbitary(cxStr, cyStr);
  const r = new BigNumber(rStr);

  function calcIterationAt(
    pixelX: number,
    pixelY: number,
    context: ReferencePointContext
  ): number {
    const { xn, xn2 } = context;
    const maxRefIteration = xn.length - 1;

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

    let iteration = 0;
    let refIteration = 0;
    // |Xn + Δn|
    let calcPointNorm = 0.0;

    const bailoutRadius = 4.0;

    while (iteration < maxIteration) {
      // Δn+1 = 2 * Xn * Δn + Δn^2 + Δ0 を計算していく
      const _deltaNRe = deltaNRe;
      const _deltaNIm = deltaNIm;

      // (2 * Xn + Δn) * Δn に展開して計算
      const dzrT = xn2[refIteration].re + _deltaNRe;
      const dziT = xn2[refIteration].im + _deltaNIm;

      deltaNRe = mulRe(dzrT, dziT, _deltaNRe, _deltaNIm) + deltaC.re;
      deltaNIm = mulIm(dzrT, dziT, _deltaNRe, _deltaNIm) + deltaC.im;

      refIteration++;

      // https://fractalforums.org/fractal-mathematics-and-new-theories/28/another-solution-to-perturbation-glitches/4360
      const zRe = xn[refIteration].re + deltaNRe;
      const zIm = xn[refIteration].im + deltaNIm;
      calcPointNorm = nNorm(zRe, zIm);
      const dzNorm = nNorm(deltaNRe, deltaNIm);

      if (calcPointNorm > bailoutRadius) break;
      if (calcPointNorm < dzNorm || refIteration === maxRefIteration) {
        deltaNRe = zRe;
        deltaNIm = zIm;
        refIteration = 0;
      }

      iteration++;
    }

    return iteration;
  }

  const context = { xn, xn2 };

  const xDiffMax = endX - startX;
  const yDiffMax = endY - startY;
  const resolutionCount = 4;

  let xDiffSeq = thin(dividerSequence(xDiffMax), resolutionCount);
  let yDiffSeq = thin(dividerSequence(yDiffMax), resolutionCount);

  if (xDiffSeq.length !== yDiffSeq.length) {
    const minLen = Math.min(xDiffSeq.length, yDiffSeq.length);
    xDiffSeq = thin(xDiffSeq, minLen);
    yDiffSeq = thin(yDiffSeq, minLen);
  }

  let calculatedCount = 0;

  for (let i = 0; i < xDiffSeq.length; i++) {
    const xDiff = xDiffSeq[i];
    const yDiff = yDiffSeq[i];

    for (let y = startY; y < endY; y = y + yDiff) {
      for (let x = startX; x < endX; x = x + xDiff) {
        const index = x - startX + (y - startY) * (endX - startX);

        if (iterations[index] !== 0) {
          continue;
        }

        const n = calcIterationAt(x, y, context);

        calculatedCount++;
        iterations[index] = n;
      }
      self.postMessage({
        type: "progress",
        progress: calculatedCount / pixelNum,
      });
    }
  }

  self.postMessage({ type: "result", iterations }, [iterations.buffer]);
});
