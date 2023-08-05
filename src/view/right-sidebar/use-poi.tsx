import { useCallback } from "react";
import { MandelbrotParams } from "../../types";
import { updateStore, useStoreValue } from "../../store/store";
import { cloneParams, setCurrentParams } from "../../mandelbrot";
import { writePOIListToStorage } from "../../store/sync-storage/poi-list";

export const usePOI = () => {
  const poiList: MandelbrotParams[] = useStoreValue("poi");

  const addPOI = useCallback(
    (newPOI: MandelbrotParams) => {
      const newPOIList = [newPOI, ...poiList];
      writePOIListToStorage(newPOIList);
      updateStore("poi", newPOIList);
    },
    [poiList],
  );

  const deletePOIAt = useCallback(
    (index: number) => {
      const newPOIList = poiList.filter((_, i) => i !== index);
      writePOIListToStorage(newPOIList);
      updateStore("poi", newPOIList);
    },
    [poiList],
  );

  const applyPOI = useCallback((poi: MandelbrotParams) => {
    setCurrentParams(cloneParams(poi));
  }, []);

  return {
    poiList,
    addPOI,
    deletePOIAt,
    applyPOI,
  };
};
