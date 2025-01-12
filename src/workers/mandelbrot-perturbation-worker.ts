/// <reference lib="webworker" />

import { decodeBLATableItems, type BLATableItem } from "@/lib/bla-table-item";
import { decodeComplexArray } from "@/lib/xn-buffer";
import { generateLowResDiffSequence } from "@/math/low-res-diff-sequence";
import BigNumber from "bignumber.js";
import {
  complexArbitary,
  dSub,
  mulIm,
  mulRe,
  nNorm,
  pixelToComplexCoordinateComplexArbitrary,
  toComplex,
} from "../math/complex";
import { IterationWorkerParams } from "../types";
import { RefOrbitContextPopulated } from "./calc-ref-orbit";

const calcHandler = (data: IterationWorkerParams) => {
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
    xn: xnBuffer,
    blaTable: blaTableBuffer,
    refX,
    refY,
    jobId,
    terminator,
    workerIdx,
  } = data;

  const startedAt = performance.now();
  console.debug(`${jobId}: start`);

  const terminateChecker = new Uint8Array(terminator);

  const xn = decodeComplexArray(xnBuffer);
  const blaTable = decodeBLATableItems(blaTableBuffer);

  const areaWidth = endX - startX;
  const areaHeight = endY - startY;
  const pixelNum = areaHeight * areaWidth;
  const iterations = new Uint32Array(pixelNum);

  const c = complexArbitary(cxStr, cyStr);
  const ref = complexArbitary(refX, refY);
  const r = new BigNumber(rStr);

  function calcIterationAt(
    pixelX: number,
    pixelY: number,
    context: RefOrbitContextPopulated,
  ): number {
    const { xn, blaTable } = context;
    const maxRefIteration = xn.length - 1;

    // Δn
    let deltaNRe = 0.0;
    let deltaNIm = 0.0;

    const current = pixelToComplexCoordinateComplexArbitrary(
      pixelX,
      pixelY,
      c,
      r,
      pixelWidth,
      pixelHeight,
    );
    // Δ0
    const deltaC = toComplex(dSub(current, ref));

    let iteration = 0;
    let refIteration = 0;

    const bailoutRadius = 4.0;

    while (iteration < maxIteration) {
      const zRe = xn[refIteration].re + deltaNRe;
      const zIm = xn[refIteration].im + deltaNIm;
      const zNorm = nNorm(zRe, zIm);
      if (zNorm > bailoutRadius) break;

      // rebase
      // https://fractalforums.org/fractal-mathematics-and-new-theories/28/another-solution-to-perturbation-glitches/4360
      const dzNorm = nNorm(deltaNRe, deltaNIm);
      if (zNorm < dzNorm || refIteration === maxRefIteration) {
        deltaNRe = zRe;
        deltaNIm = zIm;
        refIteration = 0;
      }

      const absDz = Math.sqrt(dzNorm);

      // BLA
      let bla: BLATableItem | null = null;

      // refIteration === (jIdx << d) + 1と|dz| < rを満たす、最大のlを持つデータをblaTableから探す
      if (0 < refIteration) {
        for (let d = 0; d < blaTable.length; d++) {
          // この辺まだよく分かっていない
          const jIdx = Math.floor((refIteration - 1) / 2 ** d);
          const checkM = jIdx * 2 ** d + 1;

          const isValid = absDz < blaTable[d][jIdx].r;

          if (refIteration === checkM && isValid) {
            bla = blaTable[d][jIdx];
          } else {
            break;
          }
        }
      }

      const skipped = bla?.l ?? 0;
      const n = refIteration + skipped;

      if (bla && n < maxRefIteration) {
        const { re: aRe, im: aIm } = bla.a;
        const { re: bRe, im: bIm } = bla.b;

        const dzRe =
          mulRe(aRe, aIm, deltaNRe, deltaNIm) +
          mulRe(bRe, bIm, deltaC.re, deltaC.im);
        const dzIm =
          mulIm(aRe, aIm, deltaNRe, deltaNIm) +
          mulIm(bRe, bIm, deltaC.re, deltaC.im);

        deltaNRe = dzRe;
        deltaNIm = dzIm;

        refIteration += skipped;
        iteration += skipped;
      } else {
        // Δn+1 = 2 * Xn * Δn + Δn^2 + Δ0 を計算していく
        const _deltaNRe = deltaNRe;
        const _deltaNIm = deltaNIm;

        // (2 * Xn + Δn) * Δn に展開して計算
        const dzrT = xn[refIteration].re * 2 + _deltaNRe;
        const dziT = xn[refIteration].im * 2 + _deltaNIm;

        deltaNRe = mulRe(dzrT, dziT, _deltaNRe, _deltaNIm) + deltaC.re;
        deltaNIm = mulIm(dzrT, dziT, _deltaNRe, _deltaNIm) + deltaC.im;

        refIteration++;
        iteration++;
      }
    }

    return Math.min(iteration, maxIteration);
  }

  const context = { xn, blaTable };

  const { xDiffs, yDiffs } = generateLowResDiffSequence(
    6,
    areaWidth,
    areaHeight,
  );

  let calculatedCount = 0;

  for (let i = 0; i < xDiffs.length; i++) {
    const xDiff = xDiffs[i];
    const yDiff = yDiffs[i];

    const lowResAreaWidth = Math.floor(areaWidth / xDiff);
    const lowResAreaHeight = Math.floor(areaHeight / yDiff);
    const lowResIterations = new Uint32Array(
      lowResAreaWidth * lowResAreaHeight,
    );

    let roughY = 0;
    for (let y = startY; y < endY; y = y + yDiff, roughY++) {
      let roughX = 0;

      for (let x = startX; x < endX; x = x + xDiff, roughX++) {
        const index = x - startX + (y - startY) * areaWidth;
        const indexRough = roughX + roughY * lowResAreaWidth;

        if (iterations[index] !== 0) {
          lowResIterations[indexRough] = iterations[index];
          continue;
        }

        const n = calcIterationAt(x, y, context);

        calculatedCount++;
        iterations[index] = n;
        lowResIterations[indexRough] = n;
      }

      if (terminateChecker[workerIdx] !== 0) break;

      self.postMessage({
        type: "progress",
        progress: calculatedCount / pixelNum,
      });
    }

    if (terminateChecker[workerIdx] !== 0) break;

    self.postMessage(
      {
        type: "intermediateResult",
        iterations: lowResIterations,
        resolution: { width: lowResAreaWidth, height: lowResAreaHeight },
      },
      [lowResIterations.buffer],
    );
  }
  if (terminateChecker[workerIdx] !== 0) {
    console.debug(`${jobId}: terminated`);
  } else {
    console.debug(`${jobId}: completed`);
  }

  const elapsed = performance.now() - startedAt;
  self.postMessage({ type: "result", iterations, elapsed }, [
    iterations.buffer,
  ]);
};

self.addEventListener("message", (event) => {
  switch (event.data.type) {
    case "calc": {
      calcHandler(event.data);
      break;
    }
  }
});
