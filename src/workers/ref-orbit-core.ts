import { calculate as wasmCalculate } from "../../wasm-fp/pkg/apfp.js";
import type { ComplexArbitrary } from "../math/complex";
import { add, mul, norm } from "../math/complex";
import { SKIP_BLA_ENTRY_UNTIL_THIS_L, type BLATableItem } from "./bla-table-item";

/**
 * wasm (固定精度 big float) で reference orbit を計算する。
 * limb 数は呼び出し側で必ず決定して渡すこと。
 *
 * 戻り値は [re_0, im_0, re_1, im_1, ...] レイアウトのFloat64Array
 */
export function calcRefOrbitWasm(
  referencePoint: ComplexArbitrary,
  maxIteration: number,
  limbCount: number,
): Float64Array {
  const orbit = wasmCalculate({
    type: "reference_orbit",
    x: referencePoint.re.toFixed(),
    y: referencePoint.im.toFixed(),
    max_iter: maxIteration,
    active_limbs: limbCount,
  });
  return orbit;
}

/**
 * 計算済みのReference OrbitからBLAの係数を計算する
 *
 * xn は [re_0, im_0, ...] レイアウトのFloat64Array。refLen = xn.length / 2。
 */
export function calcBLACoefficient(xn: Float64Array, refLen: number, pixelSpacing: number) {
  // Reference: https://mathr.co.uk/tmp/mandelbla.pdf

  const blaTable: BLATableItem[][] = [];

  const eps = 0.0001;

  blaTable[0] = Array.from({ length: refLen - 1 });
  for (let i = 1; i < refLen; i++) {
    const zRe = xn[i * 2];
    const zIm = xn[i * 2 + 1];
    const aRe = zRe * 2;
    const aIm = zIm * 2;
    const a = { re: aRe, im: aIm };
    const b = { re: 1.0, im: 0.0 };

    const absA = Math.sqrt(aRe * aRe + aIm * aIm);
    const r = Math.max(0, (eps * absA - pixelSpacing) / (absA + 1));
    blaTable[0][i - 1] = { a, b, r, l: 1 };
  }

  const max = Math.floor(Math.log2(refLen));

  for (let d = 0; d <= max; d++) {
    const nextTableLength = Math.floor((blaTable[d].length + 1) / 2);
    blaTable[d + 1] = Array.from({ length: nextTableLength });

    for (let j = 0; j < nextTableLength; j++) {
      const jx = j * 2;
      const jy = jx + 1;

      if (jy < blaTable[d].length) {
        const x = blaTable[d][jx];
        const y = blaTable[d][jy];

        const a = mul(y.a, x.a);
        const b = add(mul(y.a, x.b), y.b);
        const absXA = Math.sqrt(norm(x.a));
        const absXB = Math.sqrt(norm(x.b));
        const r = Math.min(x.r, Math.max(0, (y.r - absXB * pixelSpacing) / absXA));
        blaTable[d + 1][j] = { a, b, r, l: x.l + y.l };
      } else {
        blaTable[d + 1][j] = blaTable[d][jx];
      }
    }
    if (blaTable[d + 1].length === 1) break;
  }

  // スキップ量が少なくデータ量が多いエントリを抜いておく
  for (let idx = 0; idx <= Math.log2(SKIP_BLA_ENTRY_UNTIL_THIS_L); idx++) {
    blaTable[idx] = [];
  }

  // console.debug("blaTable", blaTable);

  return blaTable;
}
