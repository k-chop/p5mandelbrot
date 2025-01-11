import { getCanvasSize, getCurrentParams } from "./mandelbrot";
import { convertToPixelRect, type ComplexRect } from "./rect";
import { IterationBuffer, Resolution } from "./types";

// FIXME: 必要なくなったキャッシュを良い感じのタイミングで破棄できるようにする
let iterationCache: IterationBuffer[] = [];

export const upsertIterationCache = (
  rect: ComplexRect,
  buffer: Uint32Array,
  resolution: Resolution,
): IterationBuffer => {
  const item = { rect, buffer, resolution };
  iterationCache.push(item);

  return item;
};

export const getIterationCache = (): IterationBuffer[] => {
  return iterationCache;
};

/**
 * 現状の x, y, r（中心 + 表示範囲）に対して
 * - 数ピクセル以下になるキャッシュ
 * - 画面から完全にはみ出しているキャッシュ
 * を iterationCache から除外する
 */
export const clearIterationCache = (): void => {
  const { x: cx, y: cy, r } = getCurrentParams();
  const { width: screenWidth, height: screenHeight } = getCanvasSize();

  // 数ピクセル以下を削除する閾値 (要件に応じて調整)
  const MIN_PIXEL_SIZE = 4;

  iterationCache = iterationCache.filter((cache) => {
    // キャッシュが持っている複素数平面上のRectをピクセル座標に変換
    const pixelRect = convertToPixelRect(
      cx,
      cy,
      cache.rect,
      screenWidth,
      screenHeight,
      r,
    );

    // 1. ピクセルサイズが極端に小さいものは削除
    if (pixelRect.width < MIN_PIXEL_SIZE || pixelRect.height < MIN_PIXEL_SIZE) {
      return false;
    }

    // 2. 画面外だったら削除
    if (
      pixelRect.x + pixelRect.width < 0 ||
      pixelRect.x > screenWidth ||
      pixelRect.y + pixelRect.height < 0 ||
      pixelRect.y > screenHeight
    ) {
      return false;
    }

    return true;
  });

  console.log("iterationCache length: ", iterationCache.length);
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
