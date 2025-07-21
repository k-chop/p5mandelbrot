import type { Palette } from "@/color";
import type { Rect } from "@/math/rect";
import type { IterationBuffer } from "@/types";
import type p5 from "p5";
import { getRenderer } from "./common";

import * as p5Renderer from "./p5-renderer";
import * as webGPURenderer from "./webgpu-renderer";

/** 各rendererが実装すべき機能 */
export type Renderer = {
  // getter
  getCanvasSize: () => { width: number; height: number };
  getWholeCanvasRect: () => Rect;

  // operation
  initRenderer: (w: number, h: number, p5Instance?: p5) => Promise<boolean>;
  renderToCanvas: (
    x: number,
    y: number,
    width?: number,
    height?: number,
  ) => void;
  addIterationBuffer: (rect: Rect, iterBuffer?: IterationBuffer[]) => void;
  updatePaletteData: (palette: Palette) => void;
};

export async function initRenderer(
  w: number,
  h: number,
  p5Instance?: p5,
): Promise<boolean> {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      if (p5Instance) {
        p5Renderer.initRenderer(w, h, p5Instance);
      } else {
        console.error("p5 instance is required for p5js renderer");
      }
      return true;
    }
    case "webgpu": {
      return await webGPURenderer.initRenderer(w, h);
    }
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
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      return p5Renderer.renderToCanvas(x, y, width, height);
    }
    case "webgpu": {
      return webGPURenderer.renderToCanvas(x, y, width, height);
    }
  }
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
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      return p5Renderer.resizeCanvas(requestWidth, requestHeight);
    }
    case "webgpu": {
      // 手抜きして従来のp5rendererをそのままUI描画用canvasに使っているので両方リサイズする必要がある
      // FIXME: UI描画用canvasを分離する
      webGPURenderer.resizeCanvas(requestWidth, requestHeight);
      return p5Renderer.resizeCanvas(requestWidth, requestHeight);
    }
  }
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
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      return p5Renderer.addIterationBuffer(rect, iterBuffer);
    }
    case "webgpu": {
      return webGPURenderer.addIterationBuffer(rect, iterBuffer);
    }
  }
}

/**
 * キャンバスサイズの取得
 * @returns キャンバスの幅と高さ
 */
export function getCanvasSize(): { width: number; height: number } {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      return p5Renderer.getCanvasSize();
    }
    case "webgpu": {
      return webGPURenderer.getCanvasSize();
    }
  }
}

/**
 * キャンバス全体の矩形領域を取得
 * @returns キャンバス全体の矩形領域
 */
export function getWholeCanvasRect(): Rect {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      return p5Renderer.getWholeCanvasRect();
    }
    case "webgpu": {
      return webGPURenderer.getWholeCanvasRect();
    }
  }
}

/**
 * WebGPUレンダラー特有の機能：パレットデータの更新
 * @param palette パレット
 */
export function updatePaletteDataForGPU(
  palette: Parameters<typeof webGPURenderer.updatePaletteDataForGPU>[0],
): void {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js": {
      break; // do nothing
    }
    case "webgpu": {
      return webGPURenderer.updatePaletteDataForGPU(palette);
    }
  }
}
