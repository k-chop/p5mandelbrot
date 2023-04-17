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
      let zr = new Double(0.0);
      let zi = new Double(0.0);
      const cr = cx.add(new Double(x).mul(2).div(col).sub(1).mul(r));
      const ci = cy.sub(new Double(y).mul(2).div(row).sub(1).mul(r));

      let n = 0;
      let zr2 = new Double(0.0);
      let zi2 = new Double(0.0);
      while (zr2.add(zi2).le(R2) && n < N) {
        zi = zr.add(zr).mul(zi).add(ci);
        zr = zr2.sub(zi2).add(cr);
        zr2 = zr.mul(zr);
        zi2 = zi.mul(zi);

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
