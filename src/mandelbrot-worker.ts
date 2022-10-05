/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { WorkerParams } from "./types";

self.addEventListener("message", (event) => {
  const {
    row,
    col,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    R2,
    N,
    start,
    end,
  } = event.data as WorkerParams;

  const iterations = new Uint32Array((end - start) * col);

  const cx = parseFloat(cxStr);
  const cy = parseFloat(cyStr);
  const r = parseFloat(rStr);

  for (let y = start; y < end; y++) {
    for (let x = 0; x < col; x++) {
      let zr = 0.0;
      let zi = 0.0;
      const cr = cx + ((x * 2) / col - 1.0) * r;
      const ci = cy - ((y * 2) / row - 1.0) * r;

      let n = 0;
      let zr2 = 0.0;
      let zi2 = 0.0;
      while (zr2 + zi2 <= R2 && n < N) {
        zi = (zr + zr) * zi + ci;
        zr = zr2 - zi2 + cr;
        zr2 = zr * zr;
        zi2 = zi * zi;

        n++;
      }

      const index = x + (y - start) * col;
      iterations[index] = n;
    }
    self.postMessage({
      type: "progress",
      progress: (y - start) / (end - start),
    });
  }

  self.postMessage({ type: "result", iterations }, [iterations.buffer]);
});
