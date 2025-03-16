import type { Rect } from "@/math/rect";
import type { IterationBuffer } from "@/types";

/**
 * p5.jsとWebGPUで描画切り替えられるようにするためのinterface
 */
export interface MandelbrotRenderer {
  /**
   * rendererの初期化。内部で使うbufferなどの用意もやる
   */
  initRenderer(w: number, h: number, ...args: unknown[]): void;
  /**
   * 何をどう使って描画するかは問わないので、とにかくcanvasに描画する
   */
  renderToCanvas: (
    x: number,
    y: number,
    width?: number,
    height?: number,
  ) => void;
  /**
   * canvasのリサイズ。そのまま
   */
  resizeCanvas(requestWidth: number, requestHeight: number): void;
  /**
   * iterationBufferを内部のbufferによしなに追加して次回の描画に反映できるようにする
   * rendererが持つべき関数か？？？
   */
  addIterationBuffer: (rect: Rect, iterBuffer?: IterationBuffer[]) => void;

  // 以下はとりあえず置いといたけどrendererが持つべき関数じゃなくね？
  getCanvasSize(): { width: number; height: number };
  getWholeCanvasRect(): Rect;
}
