/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { Double } from "double.js";
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

  const cx = new Double(cxStr);
  const cy = new Double(cyStr);
  const r = new Double(rStr);
  const R2 = new Double("4.0");

  const scaleX = pixelWidth / Math.min(pixelWidth, pixelHeight);
  const scaleY = pixelHeight / Math.min(pixelWidth, pixelHeight);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      let zr = new Double(0.0);
      let zi = new Double(0.0);
      const cr = cx.add(
        new Double(x).mul(2).div(pixelWidth).sub(1).mul(r).mul(scaleX),
      );
      const ci = cy.sub(
        new Double(y).mul(2).div(pixelHeight).sub(1).mul(r).mul(scaleY),
      );

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
