import { useCallback } from "react";
import { MandelbrotParams } from "../../types";
import { updateStore, useStoreValue } from "../../store/store";
import { cloneParams, setCurrentParams } from "../../mandelbrot";

export const usePOI = () => {
  const poiList: MandelbrotParams[] = useStoreValue("poi");
  const addPOI = useCallback(
    (newPOI: MandelbrotParams) => updateStore("poi", [newPOI, ...poiList]),
    [poiList]
  );
  const deletePOIAt = useCallback(
    (index: number) => {
      const newPOI = poiList.filter((_, i) => i !== index);
      updateStore("poi", newPOI);
    },
    [poiList]
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
