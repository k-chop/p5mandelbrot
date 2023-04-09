import { Rect } from "./rect";
import { IterationBuffer } from "./types";

// FIXME: もっと賢くデータを持つ
let iterationCache: IterationBuffer[] = [];

export const addIterationCache = (rect: Rect, buffer: Uint32Array): void => {
  iterationCache.push({ rect, buffer });
};

export const getIterationCache = (): IterationBuffer[] => {
  return iterationCache;
};

export const clearIterationCache = (): void => {
  iterationCache = [];
};

export const translateRectInIterationCache = (
  offsetX: number,
  offsetY: number
): void => {
  iterationCache = iterationCache.map((iteration) => {
    return {
      rect: {
        x: iteration.rect.x - offsetX,
        y: iteration.rect.y - offsetY,
        width: iteration.rect.width,
        height: iteration.rect.height,
      },
      buffer: iteration.buffer,
    };
  });
};
