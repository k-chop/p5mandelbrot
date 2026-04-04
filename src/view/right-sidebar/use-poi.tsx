import { getCurrentPalette, setSerializedPalette } from "@/camera/palette";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import {
  cloneParams,
  getCurrentParams,
  setCurrentParams,
  setManualN,
} from "@/mandelbrot-state/mandelbrot-state";
import { getResizedCanvasImageDataURL } from "@/p5-adapter/p5-adapter";
import { getMatchingHistoryThumbnail } from "@/poi-history/poi-history";
import { deletePreview, savePreview } from "@/store/preview-store";
import { calcCoordPrecision } from "@/math/coord-precision";
import BigNumber from "bignumber.js";
import { useCallback } from "react";
import { updateStore, useStoreValue } from "../../store/store";
import { createNewPOIData, writePOIListToStorage } from "../../store/sync-storage/poi-list";
import type { MandelbrotParams, POIData } from "../../types";

/** POIサムネイルの生成サイズ(px) */
export const POI_THUMBNAIL_SIZE = 200;

/**
 * パラメータに合わせたサムネイル画像を取得する共通関数
 * 履歴から一致するものがあれば使用し、なければ直接キャプチャ
 */
function getThumbnailForParams(params: MandelbrotParams = getCurrentParams()): string {
  const matchingThumbnail = getMatchingHistoryThumbnail(params);

  if (matchingThumbnail) {
    console.log("Using existing thumbnail from history");
    return matchingThumbnail;
  }

  console.log("Capturing new thumbnail");

  try {
    return getResizedCanvasImageDataURL(POI_THUMBNAIL_SIZE);
  } catch (e) {
    console.error("Failed to capture thumbnail:", e);
    return "";
  }
}

export const usePOI = () => {
  const poiList: POIData[] = useStoreValue("poi");

  const addPOI = useCallback(
    (newParams: MandelbrotParams) => {
      const precision = calcCoordPrecision(newParams.r);
      const trimmedParams = {
        ...newParams,
        x: new BigNumber(newParams.x.toPrecision(precision)),
        y: new BigNumber(newParams.y.toPrecision(precision)),
      };
      const newPOI = createNewPOIData(trimmedParams, getCurrentPalette());
      const newPOIList = [newPOI, ...poiList];
      writePOIListToStorage(newPOIList);

      const imageDataURL = getThumbnailForParams(newParams);
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

      const imageDataURL = getThumbnailForParams();
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

      void deletePreview(del.id);
    },
    [poiList],
  );

  const applyPOI = useCallback((poi: POIData) => {
    setManualN(poi.N);
    setCurrentParams(cloneParams(poi));
    clearIterationCache();
    setSerializedPalette(poi.serializedPalette);
  }, []);

  return {
    poiList,
    addPOI,
    deletePOIAt,
    applyPOI,
    regenerateThumbnailPOI,
  };
};
