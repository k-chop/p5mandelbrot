/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { BigNumber } from "bignumber.js";

interface Parameter {
  row: number;
  col: number;
  xmin: string;
  ymax: string;
  dpp: string;
  R2: number;
  N: number;
  start: number;
  end: number;
  palette: Uint8ClampedArray;
}

self.addEventListener("message", (event) => {
  const {
    col,
    xmin: xminStr,
    ymax: ymaxStr,
    dpp: dppStr,
    R2: R2Number,
    N,
    start,
    end,
    palette,
  } = event.data as Parameter;

  const iterations = new Uint32Array((end - start) * col);
  const pixels = new Uint8ClampedArray((end - start) * col * 4);

  const xmin = new BigNumber(xminStr);
  const ymax = new BigNumber(ymaxStr);
  const dpp = new BigNumber(dppStr);
  const R2 = new BigNumber(R2Number);

  for (let i = start; i < end; i++) {
    for (let j = 0; j < col; j++) {
      let zr = new BigNumber(0.0);
      let zi = new BigNumber(0.0);
      const cr = xmin.plus(dpp.times(j));
      const ci = ymax.minus(dpp.times(i));

      let n = 0;
      let zr2 = new BigNumber(0.0);
      let zi2 = new BigNumber(0.0);
      while (zr2.plus(zi2).lte(R2) && n < N) {
        zi = zr.plus(zr).times(zi).plus(ci).precision(18);
        zr = zr2.minus(zi2).plus(cr).precision(18);
        zr2 = zr.times(zr).precision(18);
        zi2 = zi.times(zi).precision(18);

        n++;
      }

      const index = j + (i - start) * col;
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
      progress: (i - start) / (end - start),
    });
  }

  self.postMessage({ type: "result", pixels, iterations }, [
    pixels.buffer,
    iterations.buffer,
  ]);
});
