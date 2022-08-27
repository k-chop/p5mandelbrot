/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

export {};

interface Parameter {
  row: number;
  col: number;
  cx: string;
  cy: string;
  r: string;
  R2: number;
  N: number;
  start: number;
  end: number;
  palette: Uint8ClampedArray;
}

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
    palette,
  } = event.data as Parameter;

  const iterations = new Uint32Array((end - start) * col);
  const pixels = new Uint8ClampedArray((end - start) * col * 4);

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
