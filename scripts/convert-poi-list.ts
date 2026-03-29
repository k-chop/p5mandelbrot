/**
 * POI exportテキスト（point-list.txt）をJSON形式（point-list.json）に変換するスクリプト
 *
 * Usage:
 *   pnpm poi:convert [input-file]
 *
 * input-file を省略すると point-list.txt を読み込む。
 * 出力は常に point-list.json。
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { PresetPOIRaw } from "../src/preset-poi/preset-poi";
import { deserializePOIListFromText } from "../src/store/sync-storage/poi-list";
import { serializePOIData } from "../src/store/sync-storage/poi-list";

const inputFile = process.argv[2] ?? "point-list.txt";
const outputFile = "point-list.json";

const text = readFileSync(inputFile, "utf-8");
const poiDataList = deserializePOIListFromText(text);

const poiList: PresetPOIRaw[] = poiDataList.map((poi) => {
  const serialized = serializePOIData(poi);
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
