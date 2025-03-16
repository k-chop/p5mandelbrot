import type { Rect } from "@/math/rect";
import type { IterationBuffer } from "@/types";

/**
 *
 */
export interface MandelbrotRenderer {
  initRenderer(): void;
  renderToCanvas: (
    x: number,
    y: number,
    width?: number,
    height?: number,
  ) => void;
  addIterationBuffer: (rect: Rect, iterBuffer?: IterationBuffer[]) => void;
  resizeCanvas(requestWidth: number, requestHeight: number): void;
}
