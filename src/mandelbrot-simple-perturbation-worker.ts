/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { Double } from "double.js";
import { WorkerParams } from "./types";

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

  const cx = new Double(cxStr);
  const cy = new Double(cyStr);
  const r = new Double(rStr);
  const R2 = new Double(R2Number);

  console.log(cxStr, cyStr, startX, startY, endX, endY);

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
    let zr = new Double(0.0);
    let zi = new Double(0.0);
    // Δz
    let dzr = 0.0;
    let dzi = 0.0;

    // c
    const cr = cx.add(new Double(x).mul(2).div(col).sub(1).mul(r));
    const ci = cy.sub(new Double(y).mul(2).div(row).sub(1).mul(r));
    // Δc
    const dcr = cx.sub(cr).toNumber();
    const dci = cy.sub(ci).toNumber();

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
      const dziT2 = (dzi = dzrT * dzi + dziT * dzr + dci);
      dzr = dzrT2;
      dzi = dziT2;

      if (isReferencePoint) {
        const tzr = zr.mul(zr).sub(zi.mul(zi)).add(cr);
        const tzi = zr.mul(zi).add(zr.mul(zi)).add(ci);
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
