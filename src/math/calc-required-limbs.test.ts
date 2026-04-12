import { describe, expect, it } from "vitest";
import { calcRequiredLimbs, clampLimbs, MAX_LIMBS, MIN_LIMBS } from "./calc-required-limbs";

describe("calcRequiredLimbs", () => {
  it("座標が整数のみで max_iter=100 なら limbs=3", () => {
    // frac_digits=0 → coord_bits=0
    // iter_margin = 64 + 4*ceil(log2(100))=64+4*7=92
    // frac_bits=92 → frac_limbs=ceil(92/64)=2 → 1+2=3
    expect(calcRequiredLimbs("0", "0", 100)).toBe(3);
  });

  it("max_iter=1 のとき iter_margin=64 で最小 limb 数", () => {
    // frac_digits=0, coord_bits=0, iter_margin=64
    // frac_bits=64 → frac_limbs=1 → clamp(1+1,2,32)=2
    expect(calcRequiredLimbs("0", "0", 1)).toBe(2);
  });

  it("40 桁の小数 + max_iter=1000 なら limbs=5", () => {
    // frac_digits=40 → coord_bits=ceil(40*3.3219)=133
    // iter_margin=64+4*ceil(log2(1000))=64+4*10=104
    // frac_bits=237 → frac_limbs=ceil(237/64)=4 → 1+4=5
    expect(
      calcRequiredLimbs(
        "-1.4085374002233745509834968666387038777659",
        "0.1360385756605832424157267469300867279712",
        1000,
      ),
    ).toBe(5);
  });

  it("極端に桁数が多い座標は MAX_LIMBS にクランプされる", () => {
    const bigFrac = `0.${"1".repeat(1000)}`;
    expect(calcRequiredLimbs(bigFrac, bigFrac, 1000000)).toBe(MAX_LIMBS);
  });

  it("符号記号は小数桁カウントから除外される", () => {
    // frac_digits=3 → coord_bits=ceil(3*3.3219)=10
    // iter_margin=92 → frac_bits=102 → frac_limbs=2 → 3
    expect(calcRequiredLimbs("-1.234", "+5.678", 100)).toBe(3);
    // "-0.001" と "0.001" は同じ結果になる
    expect(calcRequiredLimbs("-0.001", "0", 100)).toBe(calcRequiredLimbs("0.001", "0", 100));
  });

  it("x と y のうち小数桁が多い方が採用される", () => {
    expect(calcRequiredLimbs("0.1", "0.123456789", 100)).toBe(
      calcRequiredLimbs("0.123456789", "0.1", 100),
    );
  });
});

describe("clampLimbs", () => {
  it("範囲内はそのまま返す", () => {
    expect(clampLimbs(8)).toBe(8);
  });

  it("下限未満は MIN_LIMBS にクランプ", () => {
    expect(clampLimbs(0)).toBe(MIN_LIMBS);
    expect(clampLimbs(-5)).toBe(MIN_LIMBS);
  });

  it("上限超過は MAX_LIMBS にクランプ", () => {
    expect(clampLimbs(999)).toBe(MAX_LIMBS);
  });

  it("小数は floor", () => {
    expect(clampLimbs(7.9)).toBe(7);
  });

  it("NaN は MIN_LIMBS", () => {
    expect(clampLimbs(Number.NaN)).toBe(MIN_LIMBS);
  });
});
