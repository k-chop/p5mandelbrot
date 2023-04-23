import BigNumber from "bignumber.js";
import { MandelbrotParams } from "../types";

export const writePOIListToStorage = (poiList: MandelbrotParams[]) => {
  const serialized = JSON.stringify(poiList.map(serializedMandelbrotParams));
  localStorage.setItem("poiList", serialized);
};

export const readPOIListFromStorage = (): MandelbrotParams[] => {
  const serialized = localStorage.getItem("poiList");
  if (!serialized) return [];

  const rawList = JSON.parse(serialized);
  return rawList.map(deserializedMandelbrotParams);
};

const serializedMandelbrotParams = (params: MandelbrotParams) => {
  return {
    x: params.x.toString(),
    y: params.y.toString(),
    r: params.r.toString(),
    N: params.N,
    mode: params.mode,
  };
};

const deserializedMandelbrotParams = (params: any): MandelbrotParams => {
  return {
    x: new BigNumber(params.x),
    y: new BigNumber(params.y),
    r: new BigNumber(params.r),
    N: params.N,
    mode: params.mode,
  };
};
