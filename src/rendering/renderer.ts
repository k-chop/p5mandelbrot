import type { Rect } from "@/math/rect";
import type { IterationBuffer } from "@/types";
import type p5 from "p5";
import { getRenderer } from "./common";

// 各レンダラーのインポート
import * as p5Renderer from "./p5-renderer";
import * as webGPURenderer from "./webgpu-renderer";

/**
 * 現在のレンダラーを基にした関数の実行
 * @param p5Func p5レンダラーの関数
 * @param webGPUFunc WebGPUレンダラーの関数
 * @param args 関数に渡す引数
 * @returns 関数の戻り値
 */
function runRendererFunction<T, Args extends unknown[]>(
  p5Func: (...args: Args) => T,
  webGPUFunc: (...args: Args) => T,
  ...args: Args
): T {
  const rendererType = getRenderer();
  switch (rendererType) {
    case "webgpu":
      return webGPUFunc(...args);
    case "p5js":
    default:
      return p5Func(...args);
  }
}

/**
 * レンダラーの初期化
 * @param w 幅
 * @param h 高さ
 * @param p5Instance p5インスタンス（p5レンダラーの場合のみ必要）
 * @returns レンダラーが正常に初期化されたかどうか
 */

export async function initRenderer(
  w: number,
  h: number,
  p5Instance?: p5,
): Promise<boolean> {
  const rendererType = getRenderer();

  if (rendererType === "webgpu") {
    return await webGPURenderer.initRenderer(w, h);
  } else {
    // p5.jsレンダラーは同期的な初期化
    if (p5Instance) {
      p5Renderer.initRenderer(w, h, p5Instance);
    } else {
      console.error("p5 instance is required for p5js renderer");
    }
    return true;
  }
}

/**
 * キャンバスへのレンダリング
 * @param x X座標
 * @param y Y座標
 * @param width 幅（オプション）
 * @param height 高さ（オプション）
 */
export function renderToCanvas(
  x: number,
  y: number,
  width?: number,
  height?: number,
): void {
  runRendererFunction(
    p5Renderer.renderToCanvas,
    webGPURenderer.renderToCanvas,
    x,
    y,
    width,
    height,
  );
}

/**
 * キャンバスのリサイズ
 * @param requestWidth 要求される幅
 * @param requestHeight 要求される高さ
 */
export function resizeCanvas(
  requestWidth: number,
  requestHeight: number,
): void {
  runRendererFunction(
    p5Renderer.resizeCanvas,
    webGPURenderer.resizeCanvas,
    requestWidth,
    requestHeight,
  );
}

/**
 * イテレーションバッファの追加
 * @param rect 矩形領域
 * @param iterBuffer イテレーションバッファ（オプション）
 */
export function addIterationBuffer(
  rect: Rect = { x: 0, y: 0, width: 0, height: 0 },
  iterBuffer?: IterationBuffer[],
): void {
  runRendererFunction(
    p5Renderer.addIterationBuffer,
    webGPURenderer.addIterationBuffer,
    rect,
    iterBuffer,
  );
}

/**
 * キャンバスサイズの取得
 * @returns キャンバスの幅と高さ
 */
export function getCanvasSize(): { width: number; height: number } {
  return runRendererFunction(
    p5Renderer.getCanvasSize,
    webGPURenderer.getCanvasSize,
  );
}

/**
 * キャンバス全体の矩形領域を取得
 * @returns キャンバス全体の矩形領域
 */
export function getWholeCanvasRect(): Rect {
  return runRendererFunction(
    p5Renderer.getWholeCanvasRect,
    webGPURenderer.getWholeCanvasRect,
  );
}

/**
 * WebGPUレンダラー特有の機能：パレットデータの更新
 * @param palette パレット
 */
export function updatePaletteDataForGPU(
  palette: Parameters<typeof webGPURenderer.updatePaletteDataForGPU>[0],
): void {
  if (getRenderer() === "webgpu") {
    webGPURenderer.updatePaletteDataForGPU(palette);
  }
  // p5レンダラーの場合は何もしない
}
