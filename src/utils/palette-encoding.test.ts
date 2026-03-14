import { chromaJsPalettes, d3ChromaticPalettes, othersPalettes } from "@/color";
import type { Palette } from "@/color/model";
import { describe, expect, it } from "vitest";
import { decodePalette, encodePalette } from "./palette-encoding";

const allPresets: Record<string, Palette> = {
  ...d3ChromaticPalettes,
  ...othersPalettes,
  ...chromaJsPalettes,
};

describe("palette encoding", () => {
  describe("全プリセットのラウンドトリップ", () => {
    for (const [name, palette] of Object.entries(allPresets)) {
      it(`${name}: エンコード→デコードで元のserialize値に復元される`, () => {
        const originalSerialized = palette.serialize();
        const encoded = encodePalette(palette);

        // プリセットは短いID形式になる
        expect(encoded).toMatch(/^[A-M]\./);

        const decoded = decodePalette(encoded);
        expect(decoded.serialize()).toBe(originalSerialized);
      });
    }
  });

  describe("length/offset/mirrored変更後の復元", () => {
    it("length変更後もラウンドトリップできる", () => {
      const palette = allPresets.RdYlBu;
      palette.setLength(256);
      const encoded = encodePalette(palette);
      const decoded = decodePalette(encoded);
      expect(decoded.serialize()).toBe(palette.serialize());
      // 元に戻す
      palette.setLength(128);
    });

    it("offset変更後もラウンドトリップできる", () => {
      const palette = allPresets.Turbo;
      palette.setOffset(42);
      const encoded = encodePalette(palette);
      const decoded = decodePalette(encoded);
      expect(decoded.serialize()).toBe(palette.serialize());
      palette.setOffset(0);
    });

    it("mirrored変更後もラウンドトリップできる", () => {
      const palette = allPresets.Inferno;
      palette.setMirrored(false);
      const encoded = encodePalette(palette);
      const decoded = decodePalette(encoded);
      expect(decoded.serialize()).toBe(palette.serialize());
      palette.setMirrored(true);
    });
  });

  describe("非プリセットのフォールバック", () => {
    it("カスタムパレットはserialize文字列がそのまま返る", () => {
      const serialized = "chroma-js,2,purple,orange,1,64,0";
      const decoded = decodePalette(serialized);
      expect(decoded.serialize()).toBe(serialized);
    });
  });
});
