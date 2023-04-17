/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { Double } from "double.js";
import { WorkerParams } from "./types";

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

  // TODO: とりあえず手抜きでなんと毎回Reference Pointを計算する
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
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
        const dzrT = zr.toNumber() * 2 + dzr;
        const dziT = zi.toNumber() * 2 + dzi;
        dzr = dzrT * dzr - dziT * dzi + dcr;
        dzi = dzrT * dzi + dziT * dzr + dci;

        const tzr = zr.mul(zr).sub(zi.mul(zi)).add(cr);
        const tzi = zr.mul(zi).add(zr.mul(zi)).add(ci);
        zr = tzr;
        zi = tzi;

        n++;
      }

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
