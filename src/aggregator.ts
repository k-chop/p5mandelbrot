import { type ComplexRect } from "./rect";
import { IterationBuffer, Resolution } from "./types";

// FIXME: 必要なくなったキャッシュを良い感じのタイミングで破棄できるようにする
let iterationCache: IterationBuffer[] = [];

export const upsertIterationCache = (
  rect: ComplexRect,
  buffer: Uint32Array,
  resolution: Resolution,
): void => {
  const idx = iterationCache.findIndex(
    (i) => i.rect.x === rect.x && i.rect.y === rect.y,
  );

  if (idx !== -1) {
    const old = iterationCache[idx];
    if (
      old.resolution.width * old.resolution.height <
      resolution.width * resolution.height
    ) {
      // 解像度が大きい方を採用
      iterationCache[idx] = { rect, buffer, resolution };
    }
  } else {
    iterationCache.push({ rect, buffer, resolution });
  }
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
export const getIterationTimeAt = (_worldX: number, _worldY: number) => {
  // for (const iteration of iterationCache) {
  //   if (
  //     worldX < iteration.rect.x ||
  //     iteration.rect.x + iteration.rect.width < worldX
  //   )
  //     continue;
  //   if (
  //     worldY < iteration.rect.y ||
  //     iteration.rect.y + iteration.rect.height < worldY
  //   )
  //     continue;
  //   const idx = bufferLocalLogicalIndex(
  //     Math.floor(worldX),
  //     Math.floor(worldY),
  //     iteration.rect,
  //     iteration.resolution,
  //   );

  //   return iteration.buffer[idx];
  // }
  return -1;
};
