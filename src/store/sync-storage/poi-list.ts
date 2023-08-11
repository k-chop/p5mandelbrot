import BigNumber from "bignumber.js";
import { MandelbrotParams, POIData } from "../../types";

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
