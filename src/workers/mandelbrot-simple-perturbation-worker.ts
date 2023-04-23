/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import BigNumber from "bignumber.js";
import { WorkerParams } from "../types";

type Complex = {
  r: number;
  i: number;
};

type ComplexArbitrary = {
  r: BigNumber;
  i: BigNumber;
};

type CalculationContext = {
  xn: Complex[];
  xn2: Complex[];
  glitchChecker: number[];
};

function norm(n: Complex): number {
  return n.r * n.r + n.i * n.i;
}

const PRECISION = 100;

let lastOutput: unknown;
let count = 0;
function logDebounce(a: unknown) {
  if (a !== lastOutput && count < 200) {
    console.log(a);
    lastOutput = a;
    count++;
  }
}

function calcReferencePoint(
  center: ComplexArbitrary,
  maxIteration: number
): CalculationContext {
  const e = 1.0e-6;

  const xn: Complex[] = [];
  const xn2: Complex[] = [];
  const glitchChecker: number[] = [];

  // z
  let zr = new BigNumber(0.0);
  let zi = new BigNumber(0.0);

  for (let i = 0; i <= maxIteration; i++) {
    xn.push({ r: zr.toNumber(), i: zi.toNumber() });
    const zr2Times = zr.times(2);
    xn2.push({ r: zr2Times.toNumber(), i: zi.times(2).toNumber() });
    glitchChecker.push(
      norm({ r: zr.times(e).toNumber(), i: zi.times(e).toNumber() })
    );

    zr = zr.times(zr).minus(zi.times(zi)).plus(center.r).sd(PRECISION);
    zi = zi.times(zr2Times).plus(center.i).sd(PRECISION);
  }

  return { xn, xn2, glitchChecker };
}

function pixelToComplexCoordinate(
  pixelX: number,
  pixelY: number,
  cx: BigNumber,
  cy: BigNumber,
  r: BigNumber,
  col: number,
  row: number
): ComplexArbitrary {
  return {
    r: cx.plus(
      new BigNumber(pixelX).times(2).div(col).minus(1).times(r).sd(PRECISION)
    ),
    i: cy.minus(
      new BigNumber(pixelY).times(2).div(row).minus(1).times(r).sd(PRECISION)
    ),
  };
}

self.addEventListener("message", (event) => {
  const {
    row,
    col,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    N,
    startX,
    endX,
    startY,
    endY,
  } = event.data as WorkerParams;

  const iterations = new Uint32Array((endY - startY) * (endX - startX));

  const cx = new BigNumber(cxStr);
  const cy = new BigNumber(cyStr);
  const r = new BigNumber(rStr);

  function calcIterationAt(
    pixelX: number,
    pixelY: number,
    context: CalculationContext
  ): number {
    const { xn, xn2, glitchChecker } = context;
    // Δz
    let dzr = 0.0;
    let dzi = 0.0;

    const { r: cr, i: ci } = pixelToComplexCoordinate(
      pixelX,
      pixelY,
      cx,
      cy,
      r,
      col,
      row
    );
    // Δc
    const dcr = cr.minus(cx).toNumber();
    const dci = ci.minus(cy).toNumber();

    let n = 0;
    let gcrNorm = 0.0;
    // Xnのnormが4以上なら発散することは証明されているので、たぶんXn+Δnのnormも4以上なら発散する
    // 4より大きい値にしてもいい
    const bailout = 4.0;

    while (gcrNorm < bailout && n < N) {
      let dzrT: number;
      let dziT: number;

      dzrT = xn2[n].r + dzr;
      dziT = xn2[n].i + dzi;

      const dzrT2 = dzrT * dzr - dziT * dzi + dcr;
      const dziT2 = dzrT * dzi + dziT * dzr + dci;
      dzr = dzrT2;
      dzi = dziT2;

      n++;

      const gcr = xn[n].r + dzr;
      const gci = xn[n].i + dzi;
      gcrNorm = gcr * gcr + gci * gci;
      if (gcrNorm < glitchChecker[n]) {
        // glitched
        // TODO: ちゃんと再計算する
        return -1;
      }
    }

    return n;
  }

  // FIXME: （仮）中央をReference PointとしてZnを計算
  const refY = 400;
  const refX = 400;

  const center = pixelToComplexCoordinate(refX, refY, cx, cy, r, col, row);
  const context = calcReferencePoint(center, N);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const n = calcIterationAt(x, y, context);

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
