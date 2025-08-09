import type { Palette } from "@/color";
import BigNumber from "bignumber.js";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import type { MandelbrotParams, POIData } from "../../types";
import { updateStore } from "../store";

export const createNewPOIData = (params: MandelbrotParams, palette: Palette): POIData => ({
  id: crypto.randomUUID(),
  ...params,
  serializedPalette: palette.serialize(),
});

export const writePOIListToStorage = (poiList: POIData[]) => {
  const serialized = JSON.stringify(poiList.map(serializePOIData));
  localStorage.setItem("poiList", serialized);
};

export const readPOIListFromStorage = (): POIData[] => {
  const serialized = localStorage.getItem("poiList");
  if (!serialized) return [];

  const rawList = JSON.parse(serialized);
  return rawList.map(deserializeMandelbrotParams);
};

export const serializePOIData = (params: POIData) => {
  return {
    id: params.id,
    x: params.x.toString(),
    y: params.y.toString(),
    r: params.r.toString(),
    N: params.N,
    mode: params.mode,
    serializedPalette: params.serializedPalette,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const deserializeMandelbrotParams = (params: any): POIData => {
  const id = params.id == null ? crypto.randomUUID() : params.id;

  return {
    id,
    x: new BigNumber(params.x),
    y: new BigNumber(params.y),
    r: new BigNumber(params.r),
    N: params.N,
    mode: params.mode,
    serializedPalette: params.serializedPalette,
  };
};

const mergePOIList = (
  baseList: POIData[],
  importedList: POIData[],
): { result: POIData[]; imported: number; conflicted: number } => {
  const result = [...baseList];
  let conflicted = 0;
  let imported = 0;
  const baseIds = new Set(baseList.map((poi) => poi.id));

  for (const poi of importedList) {
    if (!baseIds.has(poi.id)) {
      result.push(poi);
      imported++;
    } else {
      conflicted++;
    }
  }

  return { result, imported, conflicted };
};

export const readPOIListFromClipboard = async (): Promise<Result<string, string>> => {
  try {
    const serialized = await navigator.clipboard.readText();
    if (!serialized) return err("Clipboard is empty");

    const rawList = JSON.parse(serialized);

    const importedPOIList = rawList.map(deserializeMandelbrotParams);

    const existsPOIList = readPOIListFromStorage();
    const { result, imported, conflicted } = mergePOIList(existsPOIList, importedPOIList);

    console.info(`Imported: ${imported}, Conflicted: ${conflicted}`);

    writePOIListToStorage(result);
    updateStore("poi", result);

    return ok(`Imported: ${imported}, Conflicted: ${conflicted}`);
  } catch (e) {
    console.error(e);

    if (e instanceof Error) {
      return err(e.message);
    }
    return err("Unknown error");
  }
};
