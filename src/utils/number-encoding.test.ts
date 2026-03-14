import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { decodeNumber, encodeNumber } from "./number-encoding";

/**
 * エンコード→デコードのラウンドトリップで値が保存されることを検証する
 *
 * toPrecision() の出力をエンコードし、デコード結果を BigNumber で比較する。
 */
const roundTrip = (value: string) => {
  const encoded = encodeNumber(value);
  const decoded = decodeNumber(encoded);
  expect(new BigNumber(decoded).eq(new BigNumber(value))).toBe(true);
};

describe("number-encoding", () => {
  describe("エンコード→デコードのラウンドトリップ", () => {
    it("整数", () => {
      roundTrip("12345");
    });

    it("小数", () => {
      roundTrip("1.23456789");
    });

    it("負の整数", () => {
      roundTrip("-42");
    });

    it("負の小数", () => {
      roundTrip("-0.00123");
    });

    it("正の指数", () => {
      roundTrip("1.5e+10");
    });

    it("負の指数", () => {
      roundTrip("3.14159e-20");
    });

    it("大きい有効数字列", () => {
      roundTrip(
        "1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125",
      );
    });

    it("0", () => {
      roundTrip("0");
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
      roundTrip(value);
    });

    it("深いズームのy座標", () => {
      const value = deepY.toPrecision(146);
      roundTrip(value);
    });

    it("深いズームのr", () => {
      const value = deepR.toPrecision(6);
      roundTrip(value);
    });

    it("全体表示のr", () => {
      roundTrip("1.00000");
    });

    it("中程度ズームの座標", () => {
      const x = new BigNumber("-0.7435669");
      const y = new BigNumber("0.1314023");
      roundTrip(x.toPrecision(10));
      roundTrip(y.toPrecision(10));
    });
  });

  describe("エッジケース", () => {
    it("非常に大きい指数", () => {
      roundTrip("1.5e+300");
    });

    it("非常に小さい指数", () => {
      roundTrip("2.7e-300");
    });

    it("1桁の有効数字", () => {
      roundTrip("5");
    });

    it("指数0の負数", () => {
      roundTrip("-7");
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
