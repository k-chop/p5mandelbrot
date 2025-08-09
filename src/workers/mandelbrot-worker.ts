/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import type { IterationWorkerParams } from "../types";

self.addEventListener("message", (event) => {
  const {
    pixelHeight,
    pixelWidth,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    N,
    isSuperSampling,
    startX,
    endX,
    startY,
    endY,
  } = event.data as IterationWorkerParams;

  const startedAt = performance.now();

  const sampleScale = isSuperSampling ? 2 : 1;
  const areaPixelWidth = (endX - startX) * sampleScale;
  const areaPixelHeight = (endY - startY) * sampleScale;

  const pixelNum = areaPixelHeight * areaPixelWidth;

  const iterations = new Uint32Array(pixelNum);

  const cx = parseFloat(cxStr);
  const cy = parseFloat(cyStr);
  const r = parseFloat(rStr);
  const R2 = 4;

  const scaleX = pixelWidth / Math.min(pixelWidth, pixelHeight);
  const scaleY = pixelHeight / Math.min(pixelWidth, pixelHeight);

  const diffX = isSuperSampling ? 0.5 : 1;
  const diffY = isSuperSampling ? 0.5 : 1;

  let scaledY = 0;
  for (let y = startY; y < endY; y = y + diffY, scaledY++) {
    let scaledX = 0;
    for (let x = startX; x < endX; x = x + diffX, scaledX++) {
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

      if (isSuperSampling) {
        const scaledIndex = scaledX + scaledY * areaPixelWidth;
        iterations[scaledIndex] = n;
      } else {
        const index = Math.floor(x - startX + (y - startY) * areaPixelWidth);
        iterations[index] = n;
      }
    }
    self.postMessage({
      type: "progress",
      progress: (y - startY) / areaPixelHeight,
    });
  }

  const elapsed = performance.now() - startedAt;
  self.postMessage({ type: "result", iterations, elapsed }, [iterations.buffer]);
});
