/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

export {};

interface Parameter {
  row: number;
  col: number;
  xmin: number;
  ymax: number;
  dpp: number;
  R2: number;
  N: number;
  start: number;
  end: number;
  palette: Uint8ClampedArray;
}

self.addEventListener("message", (event) => {
  const { col, xmin, ymax, dpp, R2, N, start, end, palette } =
    event.data as Parameter;

  const iterations = new Uint32Array((end - start) * col);
  const pixels = new Uint8ClampedArray((end - start) * col * 4);

  for (let i = start; i < end; i++) {
    for (let j = 0; j < col; j++) {
      let zr = 0.0;
      let zi = 0.0;
      const cr = xmin + dpp * j;
      const ci = ymax - dpp * i;

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
