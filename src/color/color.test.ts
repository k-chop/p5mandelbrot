import { describe, expect, it } from "vitest";
import { BasePalette } from "./color";

describe("getColorIndex", () => {
  describe("mirroredがfalseの場合", () => {
    it("lengthより小さいならそのまま返す", () => {
      const palette = new BasePalette(12, false, 0);
      const result = palette.getColorIndex(0);
      expect(result).toBe(0);
    });

    it("lengthより大きいならmodを返す", () => {
      const palette = new BasePalette(12, false, 0);
      const result = palette.getColorIndex(12);
      expect(result).toBe(0);
    });
  });

  describe("mirroredがtrueの場合", () => {
    it("長さは2倍して先頭と末尾を引いた数になる", () => {
      // [0, 1, 2, 3, 4, 5] + [4, 3, 2, 1]
      // 単純に2倍すると先頭と末尾が2つ同じ色になってしまう
      const palette = new BasePalette(6, true, 0);
      const result = palette.size();
      expect(result).toBe(10);
    });

    it("lengthより小さいならそのまま返す", () => {
      const palette = new BasePalette(12, true, 0);
      const result = palette.getColorIndex(11);
      expect(result).toBe(11);
    });

    it("lengthより1小さい値ならそのまま返す", () => {
      const palette = new BasePalette(12, true, 0);
      const result = palette.getColorIndex(11);
      expect(result).toBe(11);
    });

    it("lengthと同値なら1つ折り返した値を返す", () => {
      // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] length=12
      //                                 ^ ← 1つ折り返しているのだから10を返す
      // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] + [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] length=12+(12-2)=22
      //                                            ^ つまりここ
      const palette = new BasePalette(12, true, 0);
      const result = palette.getColorIndex(12);
      expect(result).toBe(10);
    });

    it("折り返した分より大きいなら元に戻る", () => {
      // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] + [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] + [0, ...]
      //                                                                             ^ =22
      const palette = new BasePalette(12, true, 0);
      const result = palette.getColorIndex(22);
      expect(result).toBe(0);
    });
  });
});
