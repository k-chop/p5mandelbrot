/**
 * 1 limb あたりのビット数（wasm-fp/src/fixed.rs の LIMBS 実装と整合）。
 */
export const BITS_PER_LIMB = 64;

/**
 * 固定精度 big float の最大リム数（wasm-fp/src/fixed.rs::LIMBS と一致）。
 */
export const MAX_LIMBS = 32;

/**
 * 固定精度 big float の最小リム数（整数部 1 + 小数部 1）。
 */
export const MIN_LIMBS = 2;

/**
 * limb 数を有効範囲 [MIN_LIMBS, MAX_LIMBS] にクランプする。
 */
export const clampLimbs = (limbs: number): number => {
  if (!Number.isFinite(limbs)) return MIN_LIMBS;
  const n = Math.floor(limbs);
  if (n < MIN_LIMBS) return MIN_LIMBS;
  if (n > MAX_LIMBS) return MAX_LIMBS;
  return n;
};

/**
 * limb 数から有効な総ビット数を計算する（= limbs × 64）。
 */
export const totalBitsFromLimbs = (limbs: number): number => limbs * BITS_PER_LIMB;

/**
 * limb 数から小数部ビット数を計算する（= (limbs - 1) × 64）。
 */
export const fracBitsFromLimbs = (limbs: number): number => Math.max(0, limbs - 1) * BITS_PER_LIMB;

/**
 * 座標文字列の小数点以下桁数を返す。符号は無視する。
 */
const countFracDigits = (s: string): number => {
  const trimmed = s.trim().replace(/^[+-]/, "");
  const dotIdx = trimmed.indexOf(".");
  if (dotIdx === -1) return 0;
  return trimmed.length - dotIdx - 1;
};

/**
 * 座標文字列と反復回数から、reference orbit 計算に必要なリム数を計算する。
 *
 * wasm-fp/src/lib.rs にあった `calc_required_limbs` を JS 側へ移植したもの。
 * - 必要 bit 数 = ceil(小数桁数 × log2(10)) + 反復マージン
 * - 反復マージン = max_iter > 1 なら 64 + 4 × ceil(log2(max_iter)) / それ以外 64
 * - 反復中の誤差蓄積に対する余裕を max_iter に応じて動的に確保する
 * - 結果は整数部 1 limb を加算し [MIN_LIMBS, MAX_LIMBS] にクランプされる
 */
export const calcRequiredLimbs = (x: string, y: string, maxIter: number): number => {
  const fracDigits = Math.max(countFracDigits(x), countFracDigits(y));
  // log2(10) ≈ 3.3219
  const coordBits = Math.ceil(fracDigits * 3.3219);
  const iterMargin = maxIter > 1 ? 64 + 4 * Math.ceil(Math.log2(maxIter)) : 64;
  const fracBits = coordBits + iterMargin;
  const fracLimbs = Math.ceil(fracBits / BITS_PER_LIMB);
  return clampLimbs(1 + fracLimbs);
};
