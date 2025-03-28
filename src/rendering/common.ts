import type { Rect } from "@/math/rect";
import { getStore, updateStore } from "@/store/store";
import type { Resolution } from "./p5-renderer";

/**
 * 使用するレンダラーの種類
 */
export type RendererType = "webgpu" | "p5js";

/**
 * 現在使用中のレンダラータイプ
 */
let currentRenderer: RendererType = "p5js";

/**
 * WebGPUが初期化済みかどうか
 */
let webGPUInitialized = false;

/**
 * WebGPUがサポートされているか確認する
 */
export const isWebGPUSupported = (): boolean => {
  if (!navigator.gpu) {
    console.log("WebGPU is not supported in this browser");
    return false;
  }
  return true;
};

/**
 * WebGPUの初期化状態を設定する
 */
export const setWebGPUInitialized = (value: boolean): void => {
  webGPUInitialized = value;
};

/**
 * WebGPUの初期化状態を取得する
 */
export const isWebGPUInitialized = (): boolean => {
  return webGPUInitialized;
};

/**
 * 現在のレンダラーを設定する
 */
export const setRenderer = (renderer: RendererType): void => {
  currentRenderer = renderer;
  updateStore("rendererType", renderer);
  console.log(`Using ${renderer} renderer`);
};

/**
 * 現在のレンダラータイプを取得する
 */
export const getRenderer = (): RendererType => {
  return currentRenderer;
};

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
