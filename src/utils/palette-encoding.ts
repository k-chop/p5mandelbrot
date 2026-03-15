import { deserializePalette } from "@/color";
import type { Palette } from "@/color/model";

export const PERTURBATION_THRESHOLD = 3.5e-14;

const presetIdToBase = new Map<string, string>([
  ["A", "d3-chromatic,RdYlBlu"],
  ["B", "d3-chromatic,Turbo"],
  ["C", "d3-chromatic,Inferno"],
  ["D", "d3-chromatic,Sinebow"],
  ["E", "d3-chromatic,BrBG"],
  ["F", "d3-chromatic,YlGnBu"],
  ["G", "d3-chromatic,PuOr"],
  ["H", "chroma-js,4,black,red,yellow,white"],
  ["I", "chroma-js,3,lightblue,navy,white"],
  ["J", "chroma-js,4,lightgreen,green,#d3b480,green"],
  ["K", "others,hue360"],
  ["L", "others,monochrome"],
  ["M", "others,fire"],
]);

const baseToPresetId = new Map<string, string>(
  Array.from(presetIdToBase).map(([id, base]) => [base, id]),
);

/**
 * シリアライズされたパレット文字列からプリセット判定に使うベース識別子を抽出する
 */
const extractBaseIdentifier = (serialized: string): string => {
  const parts = serialized.split(",");
  const type = parts[0];

  switch (type) {
    case "d3-chromatic":
    case "others":
      return parts.slice(0, 2).join(",");
    case "chroma-js": {
      const numColors = parseInt(parts[1], 10);
      return parts.slice(0, 2 + numColors).join(",");
    }
    default:
      return serialized;
  }
};

/**
 * PaletteをURL用の短縮文字列にエンコードする
 *
 * プリセットに該当する場合は短いID表記（例: "A.1.256.0"）に変換し、
 * それ以外はシリアライズ文字列をそのまま返す
 */
export const encodePalette = (palette: Palette): string => {
  const serialized = palette.serialize();
  const base = extractBaseIdentifier(serialized);
  const presetId = baseToPresetId.get(base);

  if (presetId == null) {
    return serialized;
  }

  // serialized = "<base>,<mirrored>,<length>,<offset>"
  const remaining = serialized.slice(base.length + 1);
  const [mirrored, length, offset] = remaining.split(",");

  return `${presetId}.${mirrored}.${length}.${offset}`;
};

/**
 * エンコードされた文字列からPaletteを復元する
 *
 * プリセットID表記（例: "A.1.256.0"）の場合はベース文字列に展開してからデシリアライズし、
 * それ以外はそのままデシリアライズする
 */
export const decodePalette = (encoded: string): Palette => {
  const firstChar = encoded.charAt(0);

  if (firstChar >= "A" && firstChar <= "M" && encoded.charAt(1) === ".") {
    const [id, mirrored, length, offset] = encoded.split(".");
    const base = presetIdToBase.get(id);

    if (base == null) {
      throw new Error(`Unknown preset ID: ${id}`);
    }

    const serialized = `${base},${mirrored},${length},${offset}`;
    return deserializePalette(serialized);
  }

  return deserializePalette(encoded);
};
