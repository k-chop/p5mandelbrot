import { getCurrentPalette, setSerializedPalette } from "@/camera/palette";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import {
  cloneParams,
  setCurrentParams,
} from "@/mandelbrot-state/mandelbrot-state";
import { getResizedCanvasImageDataURL } from "@/p5-adapter/p5-adapter";
import { deletePreview, savePreview } from "@/store/preview-store";
import { useCallback } from "react";
import { updateStore, useStoreValue } from "../../store/store";
import {
  createNewPOIData,
  writePOIListToStorage,
} from "../../store/sync-storage/poi-list";
import { MandelbrotParams, POIData } from "../../types";

export const usePOI = () => {
  const poiList: POIData[] = useStoreValue("poi");

  const addPOI = useCallback(
    (newParams: MandelbrotParams) => {
      const newPOI = createNewPOIData(newParams, getCurrentPalette());
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
      poi.serializedPalette = getCurrentPalette().serialize();
      writePOIListToStorage(poiList);

      const imageDataURL = getResizedCanvasImageDataURL(100);
      savePreview(poi.id, imageDataURL);

      updateStore("poi", poiList);
    },
    [poiList],
  );

  const deletePOIAt = useCallback(
    (index: number) => {
      if (!confirm("Are you sure you want to delete this POI?")) return;

      const del = poiList[index];
      const newPOIList = poiList.filter((_, i) => i !== index);
      writePOIListToStorage(newPOIList);

      updateStore("poi", newPOIList);

      deletePreview(del.id);
    },
    [poiList],
  );

  const applyPOI = useCallback((poi: POIData) => {
    setCurrentParams(cloneParams(poi));
    clearIterationCache();
    setSerializedPalette(poi.serializedPalette);
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
