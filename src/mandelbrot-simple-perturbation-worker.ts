/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import BigNumber from "bignumber.js";
import { WorkerParams } from "./types";

const PRECISION = 100;

let lastOutput: unknown;
let count = 0;
function logDebounce(a: unknown) {
  if (a !== lastOutput && count < 200) {
    console.log(a);
    lastOutput = a;
    count++;
  }
}

self.addEventListener("message", (event) => {
  const {
    row,
    col,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    R2: R2Number,
    N,
    startX,
    endX,
    startY,
    endY,
  } = event.data as WorkerParams;

  const iterations = new Uint32Array((endY - startY) * (endX - startX));

  const cx = new BigNumber(cxStr);
  const cy = new BigNumber(cyStr);
  const r = new BigNumber(rStr);
  const R2 = new BigNumber(R2Number);

  const znr: number[] = [];
  const zni: number[] = [];

  function calcIterationAt(
    x: number,
    y: number,
    isReferencePoint: boolean,
    _znr?: number[],
    _zni?: number[]
  ): number {
    // z
    let zr = new BigNumber(0.0);
    let zi = new BigNumber(0.0);
    // Δz
    let dzr = 0.0;
    let dzi = 0.0;

    // c
    const cr = cx.plus(new BigNumber(x).times(2).div(col).minus(1).times(r));
    const ci = cy.minus(new BigNumber(y).times(2).div(row).minus(1).times(r));
    // Δc
    const dcr = cr.minus(cx).toNumber();
    const dci = ci.minus(cy).toNumber();

    let n = 0;
    while (dzr * dzr + dzi * dzi <= R2.toNumber() && n < N) {
      if (isReferencePoint) {
        znr?.push(zr.toNumber());
        zni?.push(zi.toNumber());
      }

      let dzrT: number;
      let dziT: number;
      if (isReferencePoint) {
        dzrT = zr.toNumber() * 2 + dzr;
        dziT = zi.toNumber() * 2 + dzi;
      } else {
        dzrT = _znr![n] * 2 + dzr;
        dziT = _zni![n] * 2 + dzi;
      }
      const dzrT2 = dzrT * dzr - dziT * dzi + dcr;
      const dziT2 = dzrT * dzi + dziT * dzr + dci;
      dzr = dzrT2;
      dzi = dziT2;

      if (isReferencePoint) {
        const tzr = zr
          .times(zr)
          .minus(zi.times(zi).precision(PRECISION))
          .plus(cr)
          .precision(PRECISION);
        const tzi = zr
          .times(zi)
          .plus(zr.times(zi).precision(PRECISION))
          .plus(ci)
          .precision(PRECISION);
        zr = tzr;
        zi = tzi;
      }

      n++;
    }

    return n;
  }

  // （仮）中央をReference PointとしてZnを計算
  const refY = 400;
  const refX = 400;

  calcIterationAt(refX, refY, true);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const n = calcIterationAt(x, y, false, znr, zni);

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
