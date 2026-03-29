/**
 * POI exportテキスト（point-list.txt）をJSON形式（point-list.json）に変換するスクリプト
 *
 * Usage:
 *   pnpm poi:convert [input-file]
 *
 * input-file を省略すると point-list.txt を読み込む。
 * 出力は常に point-list.json。
 */
import BigNumber from "bignumber.js";
import { readFileSync, writeFileSync } from "node:fs";
import type { PresetPOIRaw } from "../src/preset-poi/preset-poi";
import { deserializePOIListFromText, serializePOIData } from "../src/store/sync-storage/poi-list";
import { calcCoordPrecision } from "../src/math/coord-precision";

const inputFile = process.argv[2] ?? "point-list.txt";
const outputFile = "point-list.json";

const text = readFileSync(inputFile, "utf-8");
const poiDataList = deserializePOIListFromText(text);

const poiList: PresetPOIRaw[] = poiDataList.map((poi) => {
  const precision = calcCoordPrecision(poi.r);
  const trimmedX = new BigNumber(poi.x.toPrecision(precision));
  const trimmedY = new BigNumber(poi.y.toPrecision(precision));
  const serialized = serializePOIData({ ...poi, x: trimmedX, y: trimmedY });
  const raw: PresetPOIRaw = {
    x: serialized.x,
    y: serialized.y,
    r: serialized.r,
    N: serialized.N,
    mode: poi.mode,
  };
  if (serialized.serializedPalette) {
    raw.palette = serialized.serializedPalette;
  }
  return raw;
});

writeFileSync(outputFile, JSON.stringify(poiList, null, 2) + "\n");

console.log(`${inputFile} -> ${outputFile}`);
console.log(`  ${poiList.length} POIs converted`);
