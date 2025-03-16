import type { Rect } from "@/math/rect";
import { getStore } from "@/store/store";
import type { Resolution } from "./p5-renderer";

/**
 * rect内のローカル座標系(resolution)でのindexを取得する
 *
 * worldX,Yはrectの中に収まっている前提
 */
export const bufferLocalLogicalIndex = (
  worldX: number,
  worldY: number,
  rect: Rect,
  resolution: Resolution,
  isSuperSampled = false,
): number[] => {
  const localX = worldX - rect.x;
  const localY = worldY - rect.y;

  const ratioX = resolution.width / rect.width;
  const ratioY = resolution.height / rect.height;

  const scaledX = Math.floor(localX * ratioX);
  const scaledY = Math.floor(localY * ratioY);

  if (!isSuperSampled) {
    return [scaledX + scaledY * resolution.width];
  } else {
    const idx00 = scaledX + scaledY * resolution.width;
    const idx10 = scaledX + 1 + scaledY * resolution.width;
    const idx01 = scaledX + (scaledY + 1) * resolution.width;
    const idx11 = scaledX + 1 + (scaledY + 1) * resolution.width;
    return [idx00, idx10, idx01, idx11];
  }
};

/**
 * canvasのサイズをcontainerのサイズと最大サイズ設定見て初期化する
 */
export const initializeCanvasSize = () => {
  const elm = document.getElementById("canvas-wrapper");
  let w = 800;
  let h = 800;

  const maxCanvasSize = getStore("maxCanvasSize");

  if (elm) {
    w = elm.clientWidth;
    h = elm.clientHeight;
  }

  const width = maxCanvasSize === -1 ? w : Math.min(w, maxCanvasSize);
  const height = maxCanvasSize === -1 ? h : Math.min(h, maxCanvasSize);

  return { width, height };
};
