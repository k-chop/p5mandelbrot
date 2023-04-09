import { bufferLocalLogicalIndex } from "./color";
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

/**
 * マウスXY座標の位置のiteration回数を取得する
 */
export const getIterationTimeAt = (x: number, y: number) => {
  for (const iteration of iterationCache) {
    if (x < iteration.rect.x || iteration.rect.x + iteration.rect.width < x)
      continue;
    if (y < iteration.rect.y || iteration.rect.y + iteration.rect.height < y)
      continue;
    const idx = bufferLocalLogicalIndex(
      Math.floor(x),
      Math.floor(y),
      iteration.rect
    );

    return iteration.buffer[idx];
  }
  return -1;
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
