/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { MandelbrotCalculationWorkerParams } from "../types";

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
  } = event.data as MandelbrotCalculationWorkerParams;

  const iterations = new Uint32Array((endY - startY) * (endX - startX));

  const cx = parseFloat(cxStr);
  const cy = parseFloat(cyStr);
  const r = parseFloat(rStr);
  const R2 = 4;

  const scaleX = pixelWidth / Math.min(pixelWidth, pixelHeight);
  const scaleY = pixelHeight / Math.min(pixelWidth, pixelHeight);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      let zr = 0.0;
      let zi = 0.0;
      const cr = cx + ((x * 2) / pixelWidth - 1.0) * r * scaleX;
      const ci = cy - ((y * 2) / pixelHeight - 1.0) * r * scaleY;

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
