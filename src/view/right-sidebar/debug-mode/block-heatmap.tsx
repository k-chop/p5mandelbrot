import type {
  BlockDebugInfo,
  InterestingPoint,
} from "@/interesting-points/find-interesting-points";
import { getCanvasSize } from "@/rendering/renderer";
import { memo, useState } from "react";

const MINIMAP_WIDTH = 600;
const MINIMAP_HEIGHT = 600;

/**
 * スコア値を青→赤のグラデーション色に変換する
 *
 * 0→青(240°)、1→赤(0°)のHSLグラデーション。
 */
const scoreToColor = (normalizedValue: number): string => {
  const hue = 240 - normalizedValue * 240;
  return `hsl(${hue}, 80%, 50%)`;
};

/**
 * ブロックのデバッグ情報をSVGヒートマップとして描画するコンポーネント
 *
 * BatchMinimapと同じ座標変換パターンで、選択したfactorの値に応じて
 * 青→赤のグラデーションで各ブロックを色分けする。
 */
export const BlockHeatmap = memo(
  ({
    blocks,
    selectedPoints,
    centerPoint,
    selectedFactor,
    onBlockClick,
  }: {
    blocks: BlockDebugInfo[];
    selectedPoints: InterestingPoint[];
    centerPoint?: InterestingPoint | null;
    selectedFactor: string;
    onBlockClick: (block: BlockDebugInfo) => void;
  }) => {
    const [hoveredBlock, setHoveredBlock] = useState<BlockDebugInfo | null>(null);
    const canvasSize = getCanvasSize();

    if (canvasSize.width === 0 || canvasSize.height === 0 || blocks.length === 0) {
      return <div className="text-muted-foreground text-sm italic">データなし</div>;
    }

    const aspect = canvasSize.width / canvasSize.height;
    let effectiveWidth: number;
    let effectiveHeight: number;
    if (aspect > 1) {
      effectiveWidth = MINIMAP_WIDTH;
      effectiveHeight = MINIMAP_WIDTH / aspect;
    } else {
      effectiveWidth = MINIMAP_HEIGHT * aspect;
      effectiveHeight = MINIMAP_HEIGHT;
    }

    const scaleX = effectiveWidth / canvasSize.width;
    const scaleY = effectiveHeight / canvasSize.height;

    // 選択factorの値域を算出して正規化に使う
    let maxValue = 0;
    for (const block of blocks) {
      const value = selectedFactor === "score" ? block.score : (block.factors[selectedFactor] ?? 0);
      if (value > maxValue) maxValue = value;
    }

    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Blocks: {blocks.length}, Max {selectedFactor}: {maxValue.toFixed(4)}
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${effectiveWidth} ${effectiveHeight}`}
            className="w-full max-w-150 rounded border"
            style={{
              backgroundColor: "#1a1a2e",
              aspectRatio: `${effectiveWidth} / ${effectiveHeight}`,
            }}
          >
            {blocks.map((block, i) => {
              const value =
                selectedFactor === "score" ? block.score : (block.factors[selectedFactor] ?? 0);
              const normalized = maxValue > 0 ? value / maxValue : 0;
              const w = block.blockSize * scaleX;
              const h = block.blockSize * scaleY;

              return (
                <rect
                  key={i}
                  x={block.bx * scaleX}
                  y={block.by * scaleY}
                  width={Math.max(w, 1)}
                  height={Math.max(h, 1)}
                  fill={scoreToColor(normalized)}
                  fillOpacity={Math.max(0.1, normalized * 0.8)}
                  stroke="none"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredBlock(block)}
                  onMouseLeave={() => setHoveredBlock(null)}
                  onClick={() => onBlockClick(block)}
                />
              );
            })}

            {selectedPoints.map((point, i) => (
              <circle
                key={`selected-${i}`}
                cx={point.x * scaleX}
                cy={point.y * scaleY}
                r={4}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={2}
                className="pointer-events-none"
              />
            ))}

            {centerPoint && (
              <circle
                cx={centerPoint.x * scaleX}
                cy={centerPoint.y * scaleY}
                r={5}
                fill="none"
                stroke="#648cdc"
                strokeWidth={2}
                className="pointer-events-none"
              />
            )}
          </svg>

          {hoveredBlock && (
            <div className="absolute top-full left-0 z-20 mt-2 rounded bg-black px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg">
              <div>
                Block: ({hoveredBlock.bx}, {hoveredBlock.by})
              </div>
              <div>Score: {hoveredBlock.score.toFixed(6)}</div>
              {Object.entries(hoveredBlock.factors).map(([key, value]) => (
                <div key={key}>
                  {key}: {value.toFixed(6)}
                </div>
              ))}
              {hoveredBlock.peak && (
                <div>
                  Peak: ({hoveredBlock.peak.x}, {hoveredBlock.peak.y}) iter=
                  {hoveredBlock.peak.iteration}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded-full border-2"
              style={{ borderColor: "#fbbf24", backgroundColor: "transparent" }}
            />
            <span className="text-amber-400">Selected</span>
          </div>
          {centerPoint && (
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-full border-2"
                style={{ borderColor: "#648cdc", backgroundColor: "transparent" }}
              />
              <span style={{ color: "#648cdc" }}>Center</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3"
              style={{ background: "linear-gradient(to right, hsl(240,80%,50%), hsl(0,80%,50%))" }}
            />
            <span className="text-muted-foreground">Low → High</span>
          </div>
        </div>
      </div>
    );
  },
);
