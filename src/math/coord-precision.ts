import type BigNumber from "bignumber.js";

/**
 * x, yの有効数字の桁数を算出する
 *
 * ビューポートの1ピクセルは複素平面上で 2*r/canvasWidth の距離に対応する。
 * x.toPrecision(n) の丸め誤差がこの距離未満になる最小の n を返す。
 * canvasWidthは8192固定（8Kディスプレイ相当）。800〜8192で高々1〜2桁の差なので
 * 実用上問題ない。
 *
 * 導出:
 *   toPrecision(n) の最大誤差 ≈ 5 * 10^(-n)  （|x| ≈ 1 のとき）
 *   5 * 10^(-n) < 2*r/W
 *   n > log10(W/(2r)) + log10(5)
 *   → ceil(log10(W/(2r))) + 2  （安全マージン込み）
 */
/**
 * r の有効数字桁数（r 自身を圧縮保存するときに使う）
 *
 * ピクセル位置の相対変動 = r の相対誤差。端のピクセル (W/2 px) で 1 未満にしたい。
 *   5 * 10^(-n) / r * r < 2/W       （相対誤差ベース）
 *   n > log10(W/2) + log10(5) ≈ 3.6 + 0.7 = 4.3
 *   ceil(log10(W/2)) + 2 = 6 が理論最小、+1 の安全マージンで 7
 *
 * W=8192 に依存するが、canvas幅が大きく変わらない限り 7 で足りる。
 */
export const R_PRECISION = 7;

export const calcCoordPrecision = (r: BigNumber): number => {
  const CANVAS_WIDTH = 8192;
  // BigNumberの除算は DECIMAL_PLACES=20 に制約されるため、
  // log10 を個別に計算して合成する
  const rNum = r.toNumber();
  const log10r =
    rNum > 0 && isFinite(rNum)
      ? Math.log10(rNum)
      : -((r.decimalPlaces() ?? 20) - r.precision(true) + 1);
  return Math.ceil(Math.log10(CANVAS_WIDTH / 2) - log10r) + 2;
};
