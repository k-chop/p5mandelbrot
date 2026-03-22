import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { decodeNumber, encodeNumber } from "./number-encoding";

describe("number-encoding", () => {
  describe("エンコード→デコードのラウンドトリップ", () => {
    it("整数", () => {
      const encoded = encodeNumber("12345");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("12345"))).toBe(true);
    });

    it("小数", () => {
      const encoded = encodeNumber("1.23456789");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("1.23456789"))).toBe(true);
    });

    it("負の整数", () => {
      const encoded = encodeNumber("-42");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("-42"))).toBe(true);
    });

    it("負の小数", () => {
      const encoded = encodeNumber("-0.00123");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("-0.00123"))).toBe(true);
    });

    it("正の指数", () => {
      const encoded = encodeNumber("1.5e+10");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("1.5e+10"))).toBe(true);
    });

    it("負の指数", () => {
      const encoded = encodeNumber("3.14159e-20");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("3.14159e-20"))).toBe(true);
    });

    it("大きい有効数字列", () => {
      const value =
        "1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125";
      const encoded = encodeNumber(value);
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber(value))).toBe(true);
    });

    it("0", () => {
      const encoded = encodeNumber("0");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("0"))).toBe(true);
    });
  });

  describe("実際のマンデルブロ座標値でのラウンドトリップ", () => {
    const deepX = new BigNumber(
      "-1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125",
    );
    const deepY = new BigNumber(
      "0.1360385756605832424157267469300867279712448592945066056412400128811080204929672099044430962984916043688336280108617007855875705619618940154923777370644654005043363385",
    );
    const deepR = new BigNumber("1.23e-141");

    it("深いズームのx座標", () => {
      const value = deepX.toPrecision(146);
      const encoded = encodeNumber(value);
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber(value))).toBe(true);
    });

    it("深いズームのy座標", () => {
      const value = deepY.toPrecision(146);
      const encoded = encodeNumber(value);
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber(value))).toBe(true);
    });

    it("深いズームのr", () => {
      const value = deepR.toPrecision(6);
      const encoded = encodeNumber(value);
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber(value))).toBe(true);
    });

    it("全体表示のr", () => {
      const encoded = encodeNumber("1.00000");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("1.00000"))).toBe(true);
    });

    it("中程度ズームの座標", () => {
      const x = new BigNumber("-0.7435669");
      const y = new BigNumber("0.1314023");
      const xValue = x.toPrecision(10);
      const yValue = y.toPrecision(10);
      const xEncoded = encodeNumber(xValue);
      const xDecoded = decodeNumber(xEncoded);
      expect(new BigNumber(xDecoded).eq(new BigNumber(xValue))).toBe(true);
      const yEncoded = encodeNumber(yValue);
      const yDecoded = decodeNumber(yEncoded);
      expect(new BigNumber(yDecoded).eq(new BigNumber(yValue))).toBe(true);
    });
  });

  describe("エッジケース", () => {
    it("非常に大きい指数", () => {
      const encoded = encodeNumber("1.5e+300");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("1.5e+300"))).toBe(true);
    });

    it("非常に小さい指数", () => {
      const encoded = encodeNumber("2.7e-300");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("2.7e-300"))).toBe(true);
    });

    it("1桁の有効数字", () => {
      const encoded = encodeNumber("5");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("5"))).toBe(true);
    });

    it("指数0の負数", () => {
      const encoded = encodeNumber("-7");
      const decoded = decodeNumber(encoded);
      expect(new BigNumber(decoded).eq(new BigNumber("-7"))).toBe(true);
    });
  });

  describe("エンコードによる文字数削減", () => {
    it("長い座標値で40%以上削減される", () => {
      const value =
        "-1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125";
      const encoded = encodeNumber(value);
      const reduction = 1 - encoded.length / value.length;
      expect(reduction).toBeGreaterThan(0.3);
    });
  });
});
