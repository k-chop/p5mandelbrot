/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { Double } from "double.js";
import { WorkerParams } from "./main";

self.addEventListener("message", (event) => {
  const {
    row,
    col,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    R2: R2Number,
    N,
    start,
    end,
    palette,
  } = event.data as WorkerParams;

  const iterations = new Uint32Array((end - start) * col);
  const pixels = new Uint8ClampedArray((end - start) * col * 4);

  const cx = new Double(cxStr);
  const cy = new Double(cyStr);
  const r = new Double(rStr);
  const R2 = new Double(R2Number);

  for (let y = start; y < end; y++) {
    for (let x = 0; x < col; x++) {
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

      const index = x + (y - start) * col;
      iterations[index] = n;

      const pixelIndex = index * 4;

      if (n !== N) {
        const paletteIdx = (n % (palette.length / 4)) * 4;
        pixels[pixelIndex + 0] = palette[paletteIdx + 0];
        pixels[pixelIndex + 1] = palette[paletteIdx + 1];
        pixels[pixelIndex + 2] = palette[paletteIdx + 2];
        pixels[pixelIndex + 3] = palette[paletteIdx + 3];
      } else {
        pixels[pixelIndex + 0] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 255;
      }
    }
    self.postMessage({
      type: "progress",
      progress: (y - start) / (end - start),
    });
  }

  self.postMessage({ type: "result", pixels, iterations }, [
    pixels.buffer,
    iterations.buffer,
  ]);
});
