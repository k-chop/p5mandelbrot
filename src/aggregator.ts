import { getCanvasSize } from "./mandelbrot";
import { Rect } from "./rect";
import { bufferLocalLogicalIndex } from "./rendering";
import { IterationBuffer, Resolution } from "./types";

// FIXME: 配列全部舐める必要があるのよくないので良い感じにデータを持つようにする
let iterationCache: IterationBuffer[] = [];

export const upsertIterationCache = (
  rect: Rect,
  buffer: Uint32Array,
  resolution: Resolution,
): IterationBuffer => {
  const item = { rect, buffer, resolution };

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
  const minSize = 10; // 小さすぎる判定
  const maxArea = 10_000_000; // 大きすぎる判定

  const { width: canvasWidth, height: canvasHeight } = getCanvasSize();

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

    // 2. 小さすぎる
    if (width < minSize || height < minSize) {
      return false;
    }

    // 3. でかすぎる
    if (width * height > maxArea) {
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
  canvasWidth: number,
  canvasHeight: number,
): void => {
  iterationCache = iterationCache.map((iteration) => {
    // iteration.rectの中心で拡大縮小した場合を考える
    const scaledRect = scaleRectAroundMouse(
      iteration.rect,
      centerX,
      centerY,
      scale,
    );

    scaledRect.x -= centerX - canvasWidth / 2;
    scaledRect.y -= centerY - canvasHeight / 2;

    return {
      rect: scaledRect,
      buffer: iteration.buffer,
      resolution: iteration.resolution,
    };
  });
};

// マウス座標 (mouseX, mouseY) と rect 座標 (x, y, width, height) があるとします。
// rect 内部のローカル座標にマウス位置を変換してから拡大縮小し、再度グローバル座標に戻す例です。
function scaleRectAroundMouse(
  rect: Rect,
  mouseX: number,
  mouseY: number,
  scale: number,
) {
  // マウス座標を rect 原点基準に変換（ローカル座標系へ）
  const localMouseX = mouseX - rect.x;
  const localMouseY = mouseY - rect.y;

  // 幅・高さをスケール
  const newWidth = rect.width * scale;
  const newHeight = rect.height * scale;

  // rect.x, y を「マウス座標を中心に」スケールした分だけずらす
  const newX = rect.x + localMouseX - localMouseX * scale;
  const newY = rect.y + localMouseY - localMouseY * scale;

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}
