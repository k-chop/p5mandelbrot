import { useCallback } from "react";
import { MandelbrotParams, POIData } from "../../types";
import { updateStore, useStoreValue } from "../../store/store";
import { cloneParams, setCurrentParams } from "../../mandelbrot";
import {
  createNewPOIData,
  writePOIListToStorage,
} from "../../store/sync-storage/poi-list";
import { getResizedCanvasImageDataURL } from "@/canvas-reference";
import { deletePreview, savePreview } from "@/store/preview-store";

export const usePOI = () => {
  const poiList: POIData[] = useStoreValue("poi");

  const addPOI = useCallback(
    (newParams: MandelbrotParams) => {
      const newPOI = createNewPOIData(newParams);
      const newPOIList = [newPOI, ...poiList];
      writePOIListToStorage(newPOIList);

      const imageDataURL = getResizedCanvasImageDataURL(100);
      savePreview(newPOI.id, imageDataURL);

      updateStore("poi", newPOIList);
    },
    [poiList],
  );

  const regenerateThumbnailPOI = useCallback(
    (index: number) => {
      const poi = poiList[index];

      const imageDataURL = getResizedCanvasImageDataURL(100);
      savePreview(poi.id, imageDataURL);
    },
    [poiList],
  );

  const deletePOIAt = useCallback(
    (index: number) => {
      const del = poiList[index];
      const newPOIList = poiList.filter((_, i) => i !== index);
      writePOIListToStorage(newPOIList);

      updateStore("poi", newPOIList);

      deletePreview(del.id);
    },
    [poiList],
  );

  const applyPOI = useCallback((poi: MandelbrotParams) => {
    setCurrentParams(cloneParams(poi));
  }, []);

  const copyPOIListToClipboard = useCallback(() => {
    const poiListString = JSON.stringify(poiList);
    navigator.clipboard.writeText(poiListString);
  }, [poiList]);

  return {
    poiList,
    addPOI,
    deletePOIAt,
    applyPOI,
    copyPOIListToClipboard,
    regenerateThumbnailPOI,
  };
};
