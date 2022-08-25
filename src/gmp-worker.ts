/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import * as gmp from "gmp-wasm";

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

  gmp.init().then(({ calculate }) => {
    calculate(
      (g) => {
        const xmin = g.Float(xminStr);
        const ymax = g.Float(ymaxStr);
        const dpp = g.Float(dppStr);
        const R2 = g.Float(R2Number);

        for (let i = start; i < end; i++) {
          for (let j = 0; j < col; j++) {
            let zr = g.Float(0.0);
            let zi = g.Float(0.0);
            const cr = xmin.add(dpp.mul(j));
            const ci = ymax.sub(dpp.mul(i));

            let n = 0;
            let zr2 = g.Float(0.0);
            let zi2 = g.Float(0.0);
            while (zr2.add(zi2).lessOrEqual(R2) && n < N) {
              zi = zr.add(zr).mul(zi).add(ci);
              zr = zr2.sub(zi2).add(cr);
              zr2 = zr.mul(zr);
              zi2 = zi.mul(zi);

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

        return g.Float(0);
      },
      { precisionBits: 18, roundingMode: gmp.FloatRoundingMode.ROUND_UP }
    );
  });
});
