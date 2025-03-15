import { getCanvasSize, Resolution } from "@/rendering/rendering";
import { Rect } from "../math/rect";
import { bufferLocalLogicalIndex } from "../rendering/rendering";
import { IterationBuffer } from "../types";

// FIXME: 配列全部舐める必要があるのよくないので良い感じにデータを持つようにする
let iterationCache: IterationBuffer[] = [];

export const upsertIterationCache = (
  rect: Rect,
  buffer: Uint32Array,
  resolution: Resolution,
  isSuperSampled = false,
): IterationBuffer => {
  const item = { rect, buffer, resolution, isSuperSampled };

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
      iterationCache[idx] = item;
    }
  } else {
    iterationCache.push(item);
  }

  return item;
};

export const getIterationCache = (): IterationBuffer[] => {
  return iterationCache;
};

/**
 * 以下の条件でもはや描画に使用できないiterationキャッシュを削除する
 * 1. 完全に画面外にいる
 * 2. 小さすぎて描画に使えない
 * 3. でかすぎて描画に使えるピクセルが少ない
 */
export const removeUnusedIterationCache = (): void => {
  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();

  // 10pixel以下のcacheは消す
  const minSizePixel = 10;
  // rect内の1pixelがcanvas上で何pixelに相当するかで上限を設ける
  // ここでは3pixelより荒いときに消す
  // そんなに超拡大してたらほぼ画面外判定の方で消えるので、これは荒くてもよい
  const maxResolutionPerPixel = Math.floor(
    Math.min(canvasWidth, canvasHeight) / 3,
  );

  const beforeCount = iterationCache.length;

  iterationCache = iterationCache.filter((iterCache) => {
    const { x, y, width, height } = iterCache.rect;

    // 1. 完全に画面外にいる
    if (
      x + width < 0 ||
      y + height < 0 ||
      x > canvasWidth ||
      y > canvasHeight
    ) {
      return false;
    }

    // 2. 細かすぎる
    if (width < minSizePixel || height < minSizePixel) {
      return false;
    }

    // 3. 荒すぎる
    if (
      maxResolutionPerPixel < width / iterCache.resolution.width ||
      maxResolutionPerPixel < height / iterCache.resolution.height
    ) {
      return false;
    }

    return true;
  });

  const afterCount = iterationCache.length;
  console.debug(
    `${beforeCount - afterCount} iteration cache removed. Remaining: ${afterCount}`,
  );
};

/**
 * iterationキャッシュを全部クリアする
 */
export const clearIterationCache = (): void => {
  iterationCache = [];
  console.debug("Iteration cache cleared");
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
    const [idx] = bufferLocalLogicalIndex(
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

export const setIterationCache = (cache: IterationBuffer[]): void => {
  iterationCache = cache;
};

/**
 * iterationCacheを指定した点を中心にscale倍し、その点が中央に来るようにtranslateする
 */
export const scaleIterationCacheAroundPoint = (
  centerX: number,
  centerY: number,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
  iterationCache: IterationBuffer[] = getIterationCache(),
) => {
  return iterationCache.map((iteration) => {
    const scaledRect = scaleRectAroundPoint(
      iteration.rect,
      centerX,
      centerY,
      scale,
    );

    // クリック位置が画面中央に来るように位置調整
    scaledRect.x = Math.round(scaledRect.x - (centerX - canvasWidth / 2));
    scaledRect.y = Math.round(scaledRect.y - (centerY - canvasHeight / 2));

    return {
      rect: scaledRect,
      buffer: iteration.buffer,
      resolution: iteration.resolution,
    };
  });
};

/**
 * Rectを指定した点を中心にscale倍する
 */
export function scaleRectAroundPoint(
  rect: Rect,
  centerX: number,
  centerY: number,
  scale: number,
) {
  const localX = rect.x - centerX;
  const localY = rect.y - centerY;

  const newWidth = rect.width * scale;
  const newHeight = rect.height * scale;

  const newX = centerX + localX * scale;
  const newY = centerY + localY * scale;

  return {
    x: Math.round(newX),
    y: Math.round(newY),
    width: newWidth,
    height: newHeight,
  };
}
