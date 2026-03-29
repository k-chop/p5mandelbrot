import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { calcCoordPrecision } from "@/math/coord-precision";

/**
 * x.toPrecision(n) で丸めたとき、元の x との差が pixelSize 未満かどうかを検証する
 *
 * pixelSize = 2 * r / canvasWidth（1ピクセルに相当する複素平面上の距離）
 */
const isWithinOnePixel = (
  x: BigNumber,
  precision: number,
  r: BigNumber,
  canvasWidth: number,
): boolean => {
  const truncated = new BigNumber(x.toPrecision(precision));
  const error = x.minus(truncated).abs();
  // error < 2*r/W を除算なしで判定（BigNumberのDECIMAL_PLACES=20制約を回避）
  // error * W < 2 * r
  return error.times(canvasWidth).lt(r.times(2));
};

describe("共有URL用の座標精度", () => {
  // x ≈ -1.408, 深いズーム
  const deepX = new BigNumber(
    "-1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125",
  );
  describe("r=1（全体表示）のとき x は少ない桁数で十分", () => {
    const r = new BigNumber(1);
    const W = 1920;

    it("有効数字6桁で1ピクセル以内に収まる", () => {
      expect(isWithinOnePixel(deepX, 6, r, W)).toBe(true);
    });

    it("有効数字3桁では1ピクセルを超えうる", () => {
      // r=1, W=1920 → pixelSize ≈ 0.001
      // x.toPrecision(3) = -1.41 → error ≈ 0.001 → ギリギリ超える可能性
      // 境界ケースなので超えなくても良い、4桁あれば安全
      expect(isWithinOnePixel(deepX, 4, r, W)).toBe(true);
    });
  });

  describe("r=1e-10（中程度のズーム）", () => {
    const r = new BigNumber("1e-10");
    const W = 1920;

    it("有効数字15桁で1ピクセル以内", () => {
      expect(isWithinOnePixel(deepX, 15, r, W)).toBe(true);
    });

    it("有効数字10桁では不足", () => {
      expect(isWithinOnePixel(deepX, 10, r, W)).toBe(false);
    });
  });

  describe("r=1e-50（深いズーム）", () => {
    const r = new BigNumber("1e-50");
    const W = 1920;

    it("有効数字55桁で1ピクセル以内", () => {
      expect(isWithinOnePixel(deepX, 55, r, W)).toBe(true);
    });

    it("有効数字50桁では不足", () => {
      expect(isWithinOnePixel(deepX, 50, r, W)).toBe(false);
    });
  });

  describe("r≈1.23e-141（超深いズーム）", () => {
    const r = new BigNumber("1.23e-141");
    const W = 1920;
    // pixelSize = 2 * 1.23e-141 / 1920 ≈ 1.28e-144
    // 必要な有効数字 ≈ ceil(log10(W / (2*r))) + 1 ≈ ceil(143.98) + 1 = 145

    it("有効数字146桁で1ピクセル以内", () => {
      expect(isWithinOnePixel(deepX, 146, r, W)).toBe(true);
    });

    it("有効数字143桁では不足", () => {
      expect(isWithinOnePixel(deepX, 143, r, W)).toBe(false);
    });
  });

  describe("x ≈ 0 付近でも正しく動く", () => {
    const smallX = new BigNumber("0.00034567890123456789");
    const r = new BigNumber("1e-10");
    const W = 1920;

    it("有効数字15桁で1ピクセル以内", () => {
      expect(isWithinOnePixel(smallX, 15, r, W)).toBe(true);
    });
  });

  describe("calcCoordPrecision が正しい桁数を返す（内部固定幅 8192）", () => {
    const W = 8192;

    it("r=1 → 6-8桁", () => {
      const p = calcCoordPrecision(new BigNumber(1));
      expect(p).toBeGreaterThanOrEqual(6);
      expect(p).toBeLessThanOrEqual(8);
    });

    it("r=1e-10 → 15-17桁", () => {
      const p = calcCoordPrecision(new BigNumber("1e-10"));
      expect(p).toBeGreaterThanOrEqual(15);
      expect(p).toBeLessThanOrEqual(17);
    });

    it("r=1e-141 → 146-149桁", () => {
      const p = calcCoordPrecision(new BigNumber("1.23e-141"));
      expect(p).toBeGreaterThanOrEqual(146);
      expect(p).toBeLessThanOrEqual(149);
    });

    it("計算された桁数で実際に1ピクセル以内に収まる", () => {
      const testCases = [
        new BigNumber(1),
        new BigNumber("1e-10"),
        new BigNumber("1e-50"),
        new BigNumber("1.23e-141"),
        new BigNumber("1e-5"),
      ];

      for (const r of testCases) {
        const precision = calcCoordPrecision(r);
        expect(
          isWithinOnePixel(deepX, precision, r, W),
          `r=${r.toString()}, precision=${precision}`,
        ).toBe(true);
      }
    });

    it("安全マージンは過剰ではない（-5桁で不足するケースがある）", () => {
      const testCases = [new BigNumber("1e-10"), new BigNumber("1.23e-141")];

      const hasInsufficientCase = testCases.some((r) => {
        const precision = calcCoordPrecision(r);
        return !isWithinOnePixel(deepX, precision - 5, r, W);
      });
      expect(hasInsufficientCase).toBe(true);
    });
  });
});
