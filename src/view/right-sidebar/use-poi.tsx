import { getCurrentPalette, setSerializedPalette } from "@/camera/palette";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { cloneParams, setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import { requestCanvasImage } from "@/p5-adapter/p5-adapter";
import { deletePreview, savePreview } from "@/store/preview-store";
import { R_PRECISION, calcCoordPrecision } from "@/math/coord-precision";
import BigNumber from "bignumber.js";
import { useCallback } from "react";
import { updateStore, useStoreValue } from "../../store/store";
import { createNewPOIData, writePOIListToStorage } from "../../store/sync-storage/poi-list";
import type { MandelbrotParams, POIData } from "../../types";
import { POI_THUMBNAIL_SIZE } from "@/constants";

export const usePOI = () => {
  const poiList: POIData[] = useStoreValue("poi");

  const addPOI = useCallback(
    (newParams: MandelbrotParams) => {
      const precision = calcCoordPrecision(newParams.r);
      const trimmedParams = {
        ...newParams,
        x: new BigNumber(newParams.x.toPrecision(precision)),
        y: new BigNumber(newParams.y.toPrecision(precision)),
        r: new BigNumber(newParams.r.toPrecision(R_PRECISION)),
      };
      const newPOI = createNewPOIData(trimmedParams, getCurrentPalette());
      const newPOIList = [newPOI, ...poiList];
      writePOIListToStorage(newPOIList);

      // drawループ内でキャプチャする（WebGPUではテクスチャがexpireするため直接取得不可）
      requestCanvasImage(POI_THUMBNAIL_SIZE, (imageDataURL) => {
        savePreview(newPOI.id, imageDataURL);
      });
      updateStore("poi", newPOIList);
    },
    [poiList],
  );

  const regenerateThumbnailPOI = useCallback(
    (index: number) => {
      const poi = poiList[index];
      poi.serializedPalette = getCurrentPalette().serialize();
      writePOIListToStorage(poiList);

      // drawループ内でキャプチャする（WebGPUではテクスチャがexpireするため直接取得不可）
      requestCanvasImage(POI_THUMBNAIL_SIZE, (imageDataURL) => {
        savePreview(poi.id, imageDataURL);
      });
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

      void deletePreview(del.id);
    },
    [poiList],
  );

  const applyPOI = useCallback((poi: POIData) => {
    setManualN(poi.N);
    setCurrentParams(cloneParams(poi));
    clearIterationCache();
    setSerializedPalette(poi.serializedPalette);
    // 選択結果をキャンバスで見せるためモバイルのPOI drawerを閉じる (デスクトップは無害)
    updateStore("poiDrawerSnap", "closed");
  }, []);

  return {
    poiList,
    addPOI,
    deletePOIAt,
    applyPOI,
    regenerateThumbnailPOI,
  };
};
