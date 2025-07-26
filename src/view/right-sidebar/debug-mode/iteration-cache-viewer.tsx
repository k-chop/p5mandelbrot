import { useIterationCache } from "@/iteration-buffer/use-iteration-cache";
import { getCanvasSize } from "@/rendering/renderer";
import type { IterationBuffer } from "@/types";
import { useState } from "react";

interface SizeGroup {
  rectSize: { width: number; height: number };
  resolution: { width: number; height: number };
  items: IterationBuffer[];
  hasSuperSampled: boolean;
}

interface ScaleGroup {
  scale: number;
  sizeGroups: SizeGroup[];
}

// SVGミニマップのサイズ設定（変更可能）
const MINIMAP_WIDTH = 300;
const MINIMAP_HEIGHT = 300;

// 色パレット（サイズグループごと）
const SIZE_GROUP_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
];

export const IterationCacheViewer = () => {
  const cacheData = useIterationCache();
  const [detailVisibilityMap, setDetailVisibilityMap] = useState<Record<string, boolean>>({});

  const groupCacheData = (cacheData: IterationBuffer[]): ScaleGroup[] => {
    // 1段階目: scaleでグループ化
    const scaleGroups = new Map<number, Map<string, SizeGroup>>();

    for (const cache of cacheData) {
      const rectSize = { width: cache.rect.width, height: cache.rect.height };
      const resolution = cache.resolution;
      const scale =
        (rectSize.width * rectSize.height) /
        (resolution.width * resolution.height);
      const sizeKey = `${rectSize.width}x${rectSize.height}-${resolution.width}x${resolution.height}`;

      if (!scaleGroups.has(scale)) {
        scaleGroups.set(scale, new Map<string, SizeGroup>());
      }

      const sizeGroupsForScale = scaleGroups.get(scale)!;

      if (!sizeGroupsForScale.has(sizeKey)) {
        sizeGroupsForScale.set(sizeKey, {
          rectSize,
          resolution,
          items: [],
          hasSuperSampled: false,
        });
      }

      const sizeGroup = sizeGroupsForScale.get(sizeKey)!;
      sizeGroup.items.push(cache);
      if (cache.isSuperSampled) {
        sizeGroup.hasSuperSampled = true;
      }
    }

    // 結果をScaleGroup[]に変換してソート
    return Array.from(scaleGroups.entries())
      .map(([scale, sizeGroupsMap]) => ({
        scale,
        sizeGroups: Array.from(sizeGroupsMap.values()).sort((a, b) => {
          const aRectArea = a.rectSize.width * a.rectSize.height;
          const bRectArea = b.rectSize.width * b.rectSize.height;
          return bRectArea - aRectArea; // rectサイズが大きい順
        }),
      }))
      .sort((a, b) => b.scale - a.scale); // scaleが大きい順（解像度が荒い順）
  };

  const MinimapVisualization = ({
    sizeGroups,
    scaleIndex,
  }: {
    sizeGroups: SizeGroup[];
    scaleIndex: number;
  }) => {
    const [hoveredRect, setHoveredRect] = useState<{
      cache: IterationBuffer;
      sizeIndex: number;
    } | null>(null);
    const canvasSize = getCanvasSize();

    if (canvasSize.width === 0 || canvasSize.height === 0) {
      return null;
    }

    // 全キャッシュrectとキャンバスを包含するbounds計算
    const calculateBounds = () => {
      const allRects = sizeGroups.flatMap((group) =>
        group.items.map((item) => item.rect),
      );

      if (allRects.length === 0) {
        return {
          minX: 0,
          minY: 0,
          maxX: canvasSize.width,
          maxY: canvasSize.height,
        };
      }

      const minX = Math.min(
        ...allRects.map((rect) => rect.x),
        0, // キャンバス表示領域を含める
      );
      const minY = Math.min(
        ...allRects.map((rect) => rect.y),
        0, // キャンバス表示領域を含める
      );
      const maxX = Math.max(
        ...allRects.map((rect) => rect.x + rect.width),
        canvasSize.width, // キャンバス表示領域を含める
      );
      const maxY = Math.max(
        ...allRects.map((rect) => rect.y + rect.height),
        canvasSize.height, // キャンバス表示領域を含める
      );

      return { minX, minY, maxX, maxY };
    };

    const bounds = calculateBounds();
    const boundsWidth = bounds.maxX - bounds.minX;
    const boundsHeight = bounds.maxY - bounds.minY;

    // アスペクト比を保持した動的SVGサイズの計算
    const boundsAspect = boundsWidth / boundsHeight;
    
    let effectiveWidth: number, effectiveHeight: number;
    
    if (boundsAspect > 1) {
      // boundsが横長 → 最大幅を基準にする
      effectiveWidth = MINIMAP_WIDTH;
      effectiveHeight = MINIMAP_WIDTH / boundsAspect;
    } else {
      // boundsが縦長 → 最大高さを基準にする
      effectiveWidth = MINIMAP_HEIGHT * boundsAspect;
      effectiveHeight = MINIMAP_HEIGHT;
    }

    // 座標をSVG座標系に正規化する関数（シンプル版）
    const normalizeToSVG = (rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => {
      const x = ((rect.x - bounds.minX) / boundsWidth) * effectiveWidth;
      const y = ((rect.y - bounds.minY) / boundsHeight) * effectiveHeight;
      const width = (rect.width / boundsWidth) * effectiveWidth;
      const height = (rect.height / boundsHeight) * effectiveHeight;
      return { x, y, width, height };
    };

    // キャンバス表示領域のSVG座標
    const canvasViewRect = normalizeToSVG({
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
    });

    return (
      <div className="space-y-2">
        <div className="relative">
          <svg
            width={effectiveWidth}
            height={effectiveHeight}
            className="rounded border"
            style={{ backgroundColor: "#f8fafc" }}
          >
            {/* 背景グリッド */}
            <defs>
              <pattern
                id={`grid-${scaleIndex}`}
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            {/* 背景グリッド */}
            <rect
              width={effectiveWidth}
              height={effectiveHeight}
              fill={`url(#grid-${scaleIndex})`}
            />

            {/* キャッシュrectを描画 */}
            {sizeGroups.map((sizeGroup, sizeIndex) => {
              const color =
                SIZE_GROUP_COLORS[sizeIndex % SIZE_GROUP_COLORS.length];
              return sizeGroup.items.map((cache, itemIndex) => {
                const normalizedRect = normalizeToSVG(cache.rect);
                return (
                  <rect
                    key={`${sizeIndex}-${itemIndex}`}
                    x={normalizedRect.x}
                    y={normalizedRect.y}
                    width={normalizedRect.width}
                    height={normalizedRect.height}
                    fill={color}
                    fillOpacity={0.6}
                    stroke={color}
                    strokeWidth={1}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onMouseEnter={() => setHoveredRect({ cache, sizeIndex })}
                    onMouseLeave={() => setHoveredRect(null)}
                  />
                );
              });
            })}

            {/* キャンバス表示領域（赤枠） */}
            <rect
              x={canvasViewRect.x}
              y={canvasViewRect.y}
              width={canvasViewRect.width}
              height={canvasViewRect.height}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4,2"
              className="pointer-events-none"
            />
          </svg>

          {/* ホバー時のツールチップ */}
          {hoveredRect && (
            <div className="absolute top-full left-0 z-20 mt-2 rounded bg-black px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg">
              <div>
                Position: ({hoveredRect.cache.rect.x.toFixed(1)},{" "}
                {hoveredRect.cache.rect.y.toFixed(1)})
              </div>
              <div>
                Size: {hoveredRect.cache.rect.width.toFixed(1)}×
                {hoveredRect.cache.rect.height.toFixed(1)}
              </div>
              <div>
                Resolution: {hoveredRect.cache.resolution.width}×
                {hoveredRect.cache.resolution.height}
              </div>
              {hoveredRect.cache.isSuperSampled && <div>Super Sampled</div>}
              {/* ツールチップの矢印 */}
              <div className="absolute bottom-full left-4 h-0 w-0 border-r-4 border-b-4 border-l-4 border-transparent border-b-black" />
            </div>
          )}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Canvas View表示 */}
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3 border-2 border-dashed"
              style={{ borderColor: "#ef4444" }}
            />
            <span className="font-medium text-red-600">
              Canvas View ({canvasSize.width}×{canvasSize.height})
            </span>
          </div>

          {/* サイズグループ凡例 */}
          {sizeGroups.map((sizeGroup, sizeIndex) => {
            const color =
              SIZE_GROUP_COLORS[sizeIndex % SIZE_GROUP_COLORS.length];
            return (
              <div key={sizeIndex} className="flex items-center gap-1">
                <div
                  className="h-3 w-3 border"
                  style={{ backgroundColor: color, opacity: 0.6 }}
                />
                <span>
                  {sizeGroup.rectSize.width.toFixed(1)}×
                  {sizeGroup.rectSize.height.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Iteration Cache (count: {cacheData.length})
        </h3>
      </div>

      <div className="space-y-4">
        {(() => {
          const scaleGroups = groupCacheData(cacheData);
          return (
            <>
              {scaleGroups.length === 0 ? (
                <div className="text-muted-foreground text-sm italic">
                  キャッシュデータはありません
                </div>
              ) : (
                <div className="space-y-4">
                  {scaleGroups.map((scaleGroup, scaleIndex) => (
                    <div key={scaleIndex} className="space-y-2">
                      <div className="text-base font-semibold">
                        Scale: {scaleGroup.scale.toFixed(2)}
                      </div>

                      <div className="space-y-3 pl-4">
                        {/* SVGミニマップ */}
                        <MinimapVisualization
                          sizeGroups={scaleGroup.sizeGroups}
                          scaleIndex={scaleIndex}
                        />

                        {/* サイズ情報リスト（常に表示） */}
                        {scaleGroup.sizeGroups.map((sizeGroup, sizeIndex) => {
                          const detailKey = `${scaleIndex}-${sizeIndex}`;
                          return (
                            <div
                              key={sizeIndex}
                              className="rounded-lg border p-3 text-sm"
                            >
                              <button
                                onClick={() => setDetailVisibilityMap(prev => ({
                                  ...prev,
                                  [detailKey]: !prev[detailKey]
                                }))}
                                className="flex w-full items-center gap-2 text-left"
                              >
                                <span className="text-xs text-blue-600">
                                  {detailVisibilityMap[detailKey] ? "▼" : "▶"}
                                </span>
                                <div
                                  className="h-3 w-3 border"
                                  style={{
                                    backgroundColor:
                                      SIZE_GROUP_COLORS[
                                        sizeIndex % SIZE_GROUP_COLORS.length
                                      ],
                                    opacity: 0.6,
                                  }}
                                />
                                <span className="font-medium">
                                  {sizeGroup.rectSize.width.toFixed(1)}×
                                  {sizeGroup.rectSize.height.toFixed(1)} @{" "}
                                  {sizeGroup.resolution.width}×
                                  {sizeGroup.resolution.height} -{" "}
                                  {sizeGroup.items.length}個
                                </span>
                                {sizeGroup.hasSuperSampled && (
                                  <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                                    Super Sampled
                                  </span>
                                )}
                              </button>

                              {/* 座標リスト */}
                              {detailVisibilityMap[detailKey] && (
                                <div className="mt-3 space-y-1 pl-4">
                                  {sizeGroup.items.map((cache, itemIndex) => (
                                    <div
                                      key={itemIndex}
                                      className="text-muted-foreground text-xs"
                                    >
                                      • ({cache.rect.x.toFixed(1)},{" "}
                                      {cache.rect.y.toFixed(1)})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};
