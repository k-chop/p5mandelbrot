import BigNumber from "bignumber.js";
import { MandelbrotParams, POIData } from "../../types";
import { Result, err, ok } from "neverthrow";
import { updateStore } from "../store";

export const createNewPOIData = (params: MandelbrotParams): POIData => ({
  id: crypto.randomUUID(),
  ...params,
});

export const writePOIListToStorage = (poiList: POIData[]) => {
  const serialized = JSON.stringify(poiList.map(serializedMandelbrotParams));
  localStorage.setItem("poiList", serialized);
};

export const readPOIListFromStorage = (): POIData[] => {
  const serialized = localStorage.getItem("poiList");
  if (!serialized) return [];

  const rawList = JSON.parse(serialized);
  return rawList.map(deserializedMandelbrotParams);
};

const serializedMandelbrotParams = (params: POIData) => {
  return {
    id: params.id,
    x: params.x.toString(),
    y: params.y.toString(),
    r: params.r.toString(),
    N: params.N,
    mode: params.mode,
  };
};

const deserializedMandelbrotParams = (params: any): POIData => {
  const id = params.id == null ? crypto.randomUUID() : params.id;

  return {
    id,
    x: new BigNumber(params.x),
    y: new BigNumber(params.y),
    r: new BigNumber(params.r),
    N: params.N,
    mode: params.mode,
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

export const readPOIListFromClipboard = async (): Promise<
  Result<string, string>
> => {
  try {
    const serialized = await navigator.clipboard.readText();
    if (!serialized) return err("Clipboard is empty");

    const rawList = JSON.parse(serialized);

    const importedPOIList = rawList.map(deserializedMandelbrotParams);

    const existsPOIList = readPOIListFromStorage();
    const { result, imported, conflicted } = mergePOIList(
      existsPOIList,
      importedPOIList,
    );

    console.log(`Imported: ${imported}, Conflicted: ${conflicted}`);

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
