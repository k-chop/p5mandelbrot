import { Rect } from "./rect";
import { bufferLocalLogicalIndex } from "./rendering";
import { IterationBuffer, Resolution } from "./types";

// FIXME: たぶんIterationBufferは複素数平面座標に対するキャッシュを持つべき
// それならrがどうであれ使い回せるはず
// 一方でちゃんとピクセル座標と誤差なく対応させられるかわからない
// BigNumberだし比較重いかも

// FIXME: もっと賢くデータを持つ
let iterationCache: IterationBuffer[] = [];

export const upsertIterationCache = (
  rect: Rect,
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
export const getIterationTimeAt = (worldX: number, worldY: number) => {
  for (const iteration of iterationCache) {
    if (
      worldX < iteration.rect.x ||
      iteration.rect.x + iteration.rect.width < worldX
    )
      continue;
    if (
      worldY < iteration.rect.y ||
      iteration.rect.y + iteration.rect.height < worldY
    )
      continue;
    const idx = bufferLocalLogicalIndex(
      Math.floor(worldX),
      Math.floor(worldY),
      iteration.rect,
      iteration.resolution,
    );

    return iteration.buffer[idx];
  }
  return -1;
};

export const translateRectInIterationCache = (
  offsetX: number,
  offsetY: number,
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
      resolution: iteration.resolution,
    };
  });
};

export const scaleIterationCacheAroundPoint = (
  centerX: number,
  centerY: number,
  scale: number,
): void => {
  console.log("scale!", { centerX, centerY, scale });

  iterationCache = iterationCache.map((iteration) => {
    const { x, y, width, height } = iteration.rect;

    console.log("before", { x, y, width, height });

    // iteration.rectの中心で拡大縮小した場合を考える

    // (x, y) を (centerX, centerY) 基準に平行移動（差分を取り）→ scale 倍 → 中心へ戻す
    const newX = centerX + (x - centerX) * scale;
    const newY = centerY + (y - centerY) * scale;

    // 幅・高さはそのまま倍率をかけるだけ
    const newWidth = width * scale;
    const newHeight = height * scale;

    console.log("after", { newX, newY, newWidth, newHeight });

    return {
      rect: {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      },
      buffer: iteration.buffer,
      resolution: iteration.resolution,
    };
  });
};
