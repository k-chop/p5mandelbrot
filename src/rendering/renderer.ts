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
  /**
   * 描画域のサイズをpixel単位で返す
   *
   * rendererが持つべき関数かこれ？
   */
  getCanvasSize: () => { width: number; height: number };
  /**
   * 描画域をRect(0, 0, width, height)の形式で返す
   */
  getWholeCanvasRect: () => Rect;

  // operation
  /**
   * rendererを初期化する
   *
   * Promiseを返すがp5の方は同期的に完了する
   */
  initRenderer: (w: number, h: number, p5Instance?: p5) => Promise<boolean>;
  /**
   * canvasのresizeを行う
   *
   * 関連するリソースの確保し直しなどをやる
   */
  resizeCanvas: (requestWidth: number, requestHeight: number) => void;
  /**
   * canvasへの描画を行う
   *
   * 描画されるべきデータは既にrendererにセットされているので、描画域の指定のみ可能
   */
  renderToCanvas: (
    x: number,
    y: number,
    width?: number,
    height?: number,
  ) => void;
  /**
   * 描画するためのiterationBufferをrendererに登録する
   */
  addIterationBuffer: (rect?: Rect, iterBuffer?: IterationBuffer[]) => void;
  /**
   * renderer側でのpalette dataの登録を行う
   *
   * paletteの内容変更時に呼び出す
   */
  updatePaletteData: (palette: Palette) => void;
};

export const initRenderer: Renderer["initRenderer"] = async (
  w,
  h,
  p5Instance?,
) => {
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
    case "webgpu":
      return webGPURenderer.initRenderer(w, h);
  }
};

export const renderToCanvas: Renderer["renderToCanvas"] = (...args) => {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js":
      return p5Renderer.renderToCanvas(...args);
    case "webgpu":
      return webGPURenderer.renderToCanvas(...args);
  }
};

export const resizeCanvas: Renderer["resizeCanvas"] = (...args) => {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js":
      return p5Renderer.resizeCanvas(...args);
    case "webgpu": {
      // 手抜きして従来のp5rendererをそのままUI描画用canvasに使っているので両方リサイズする必要がある
      // FIXME: UI描画用canvasを分離する
      webGPURenderer.resizeCanvas(...args);
      return p5Renderer.resizeCanvas(...args);
    }
  }
};

export const addIterationBuffer: Renderer["addIterationBuffer"] = (...args) => {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js":
      return p5Renderer.addIterationBuffer(...args);
    case "webgpu":
      return webGPURenderer.addIterationBuffer(...args);
  }
};

export const getCanvasSize: Renderer["getCanvasSize"] = () => {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js":
      return p5Renderer.getCanvasSize();
    case "webgpu":
      return webGPURenderer.getCanvasSize();
  }
};

export const getWholeCanvasRect: Renderer["getWholeCanvasRect"] = () => {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js":
      return p5Renderer.getWholeCanvasRect();
    case "webgpu":
      return webGPURenderer.getWholeCanvasRect();
  }
};

export const updatePaletteData: Renderer["updatePaletteData"] = (...args) => {
  const rendererType = getRenderer();

  switch (rendererType) {
    case "p5js":
      break; // do nothing
    case "webgpu":
      return webGPURenderer.updatePaletteData(...args);
  }
};
