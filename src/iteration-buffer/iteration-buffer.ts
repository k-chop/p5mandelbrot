import { bufferLocalLogicalIndex } from "@/rendering/common";
import type { Resolution } from "@/rendering/p5-renderer";
import { getCanvasSize } from "@/rendering/renderer";
import { debounce } from "es-toolkit";
import type { Rect } from "../math/rect";
import type { IterationBuffer } from "../types";

// FIXME: 配列全部舐める必要があるのよくないので良い感じにデータを持つようにする
let iterationCache: IterationBuffer[] = [];
let iterationCacheSnapshot: IterationBuffer[] = [];

// Subscription system for iteration cache updates
const subscribers: Set<() => void> = new Set();

/**
 * iterationキャッシュにrectを追加、または同じ位置の既存エントリをより高解像度のもので更新する
 *
 * isSuperSampledがtrueの場合はキャッシュに積まずアイテムをそのまま返す
 */
export const upsertIterationCache = (
  rect: Rect,
  buffer: Uint32Array<ArrayBuffer>,
  resolution: Resolution,
  isSuperSampled = false,
): IterationBuffer => {
  const item = { rect, buffer, resolution, isSuperSampled };

  const idx = iterationCache.findIndex((i) => i.rect.x === rect.x && i.rect.y === rect.y);

  // supersampledな場合は別経路の描画なのでiterationCacheには積まない
  if (isSuperSampled) return item;

  if (idx !== -1) {
    const old = iterationCache[idx];
    if (old.resolution.width * old.resolution.height < resolution.width * resolution.height) {
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
 * useSyncExternalStore用のsnapshotを返す
 *
 * 未変化のときに参照が変わらないように取っておいたsnapshotを返す
 */
export const getIterationCacheSnapshot = (): IterationBuffer[] => {
  return iterationCacheSnapshot;
};

/**
 * useSynExternalStore用のsnapshotを更新
 */
const updateSnapshot = (): void => {
  iterationCacheSnapshot = iterationCache.map((iterCache) => ({
    ...iterCache,
  }));
};

// Subscription functions for cache updates
export const subscribeToIterationCacheUpdates = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

/**
 * useIterationCacheに変更を伝えたいときに呼ぶ
 */
export const notifyIterationCacheUpdate = debounce(() => {
  updateSnapshot();
  subscribers.forEach((callback) => callback());
}, 250);

/**
 * 以下の条件でもはや描画に使用できないiterationキャッシュを削除する
 *
 * 0. 解像度比率が1に最も近いcache以外
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
  const maxResolutionPerPixel = Math.floor(Math.min(canvasWidth, canvasHeight) / 3);

  const beforeCount = iterationCache.length;

  // 解像度比率が1に最も近いもの以外のcacheは消す
  const targetRes = iterationCache.reduce((prev, iterCache) => {
    const res = iterCache.resolution.width / iterCache.rect.width;
    return Math.abs(res - 1) < Math.abs(prev - 1) ? res : prev;
  }, Number.MAX_VALUE);
  iterationCache = iterationCache.filter((iterCache) => {
    const res = iterCache.resolution.width / iterCache.rect.width;
    return Math.abs(res - targetRes) < Number.EPSILON;
  });

  iterationCache = iterationCache.filter((iterCache) => {
    const { x, y, width, height } = iterCache.rect;

    // 1. 完全に画面外にいる
    if (x + width < 0 || y + height < 0 || x > canvasWidth || y > canvasHeight) {
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
  console.debug(`${beforeCount - afterCount} iteration cache removed. Remaining: ${afterCount}`);
};

/**
 * 断片化したiterationCacheをキャンバス全体をカバーする1枚のIterationBufferに統合する
 *
 * 全workerのバッチ完了後に呼び出すことで、ズーム・移動の繰り返しによる断片化を解消する
 */
export const consolidateIterationCache = (canvasWidth?: number, canvasHeight?: number): void => {
  if (iterationCache.length <= 1) return;

  const { width: cw, height: ch } =
    canvasWidth != null && canvasHeight != null
      ? { width: canvasWidth, height: canvasHeight }
      : getCanvasSize();

  // 解像度比率が1に最も近いキャッシュのみ対象
  const targetRes = iterationCache.reduce((prev, ic) => {
    const res = ic.resolution.width / ic.rect.width;
    return Math.abs(res - 1) < Math.abs(prev - 1) ? res : prev;
  }, Number.MAX_VALUE);

  const targets = iterationCache.filter((ic) => {
    const res = ic.resolution.width / ic.rect.width;
    return Math.abs(res - targetRes) < Number.EPSILON;
  });

  if (targets.length <= 1) return;

  const mergedBuffer = new Uint32Array(cw * ch);

  for (const ic of targets) {
    const { rect, buffer, resolution } = ic;
    const ox = Math.max(0, rect.x);
    const oy = Math.max(0, rect.y);
    const ex = Math.min(cw, rect.x + rect.width);
    const ey = Math.min(ch, rect.y + rect.height);
    if (ox >= ex || oy >= ey) continue;

    const ratioX = resolution.width / rect.width;
    const ratioY = resolution.height / rect.height;

    if (ratioX === 1 && ratioY === 1) {
      for (let py = oy; py < ey; py++) {
        const srcStart = (py - rect.y) * resolution.width + (ox - rect.x);
        const dstStart = py * cw + ox;
        const width = ex - ox;
        mergedBuffer.set(buffer.subarray(srcStart, srcStart + width), dstStart);
      }
    } else {
      for (let py = oy; py < ey; py++) {
        for (let px = ox; px < ex; px++) {
          const srcX = Math.floor((px - rect.x) * ratioX);
          const srcY = Math.floor((py - rect.y) * ratioY);
          const srcIdx = srcY * resolution.width + srcX;
          mergedBuffer[py * cw + px] = buffer[srcIdx];
        }
      }
    }
  }

  iterationCache = [
    {
      rect: { x: 0, y: 0, width: cw, height: ch },
      buffer: mergedBuffer,
      resolution: { width: cw, height: ch },
    },
  ];
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
    // 解像度が荒いやつを無視 (表示にはx1.0のもののみ利用する)
    if (iteration.rect.width !== iteration.resolution.width) continue;
    // 範囲内になければ無視
    if (worldX < iteration.rect.x || iteration.rect.x + iteration.rect.width < worldX) continue;
    if (worldY < iteration.rect.y || iteration.rect.y + iteration.rect.height < worldY) continue;

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

/**
 * 指定矩形内をグリッド状にサンプリングしてiteration値の配列を返す
 */
export const sampleIterationsInRegion = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  gridSize: number,
): number[] => {
  const samples: number[] = [];
  const stepX = (x2 - x1) / gridSize;
  const stepY = (y2 - y1) / gridSize;

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const sx = x1 + (gx + 0.5) * stepX;
      const sy = y1 + (gy + 0.5) * stepY;
      samples.push(getIterationTimeAt(sx, sy));
    }
  }

  return samples;
};

/**
 * iterationキャッシュ内の全rectを指定オフセット分だけ平行移動する
 */
export const translateRectInIterationCache = (offsetX: number, offsetY: number): void => {
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
    const scaledRect = scaleRectAroundPoint(iteration.rect, centerX, centerY, scale);

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
export function scaleRectAroundPoint(rect: Rect, centerX: number, centerY: number, scale: number) {
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
