import type {
  BlockDebugInfo,
  InterestingPoint,
} from "@/interesting-points/find-interesting-points";
import { getCanvasSize } from "@/rendering/renderer";
import { type MouseEvent, memo, useCallback, useEffect, useRef, useState } from "react";

const MINIMAP_WIDTH = 600;
const MINIMAP_HEIGHT = 600;

/**
 * スコア値(0〜1)をRGBA色に変換する
 *
 * HSL(240→0, 80%, 50%)のグラデーションをRGBに直接計算する。
 */
const scoreToRgb = (normalized: number): [number, number, number] => {
  const hue = (240 - normalized * 240) / 360;
  const s = 0.8;
  const l = 0.5;

  const hue2rgb = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, hue + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hue) * 255);
  const b = Math.round(hue2rgb(p, q, hue - 1 / 3) * 255);
  return [r, g, b];
};

/** canvas上の座標からブロックを逆引きする */
const findBlockAtPosition = (
  mx: number,
  my: number,
  blocks: BlockDebugInfo[],
  scaleX: number,
  scaleY: number,
): BlockDebugInfo | null => {
  // 後ろから探索（描画順で上に重なっているブロックを優先）
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const x = block.bx * scaleX;
    const y = block.by * scaleY;
    const w = Math.max(block.blockSize * scaleX, 1);
    const h = Math.max(block.blockSize * scaleY, 1);
    if (mx >= x && mx < x + w && my >= y && my < y + h) {
      return block;
    }
  }
  return null;
};

/**
 * ブロックのデバッグ情報をCanvasヒートマップとして描画するコンポーネント
 *
 * 選択したfactorの値に応じて青→赤のグラデーションで各ブロックを色分けする。
 * SVGではなくCanvasを使用することで大量ブロックでも高速に描画できる。
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredBlock, setHoveredBlock] = useState<BlockDebugInfo | null>(null);
    const canvasSize = getCanvasSize();

    const aspect = canvasSize.width / canvasSize.height;
    const effectiveWidth = aspect > 1 ? MINIMAP_WIDTH : MINIMAP_HEIGHT * aspect;
    const effectiveHeight = aspect > 1 ? MINIMAP_WIDTH / aspect : MINIMAP_HEIGHT;
    const scaleX = effectiveWidth / canvasSize.width;
    const scaleY = effectiveHeight / canvasSize.height;

    // ヒートマップ本体の描画（データが変わったときだけ実行）
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || canvasSize.width === 0 || canvasSize.height === 0 || blocks.length === 0)
        return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = effectiveWidth;
      canvas.height = effectiveHeight;

      // 背景クリア
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, effectiveWidth, effectiveHeight);

      // maxValue算出
      let maxValue = 0;
      for (const block of blocks) {
        const value =
          selectedFactor === "score" ? block.score : (block.factors[selectedFactor] ?? 0);
        if (value > maxValue) maxValue = value;
      }

      // ブロック描画
      for (const block of blocks) {
        const value =
          selectedFactor === "score" ? block.score : (block.factors[selectedFactor] ?? 0);
        const normalized = maxValue > 0 ? value / maxValue : 0;
        const [r, g, b] = scoreToRgb(normalized);
        const alpha = Math.max(0.1, normalized * 0.8);

        const x = block.bx * scaleX;
        const y = block.by * scaleY;
        const w = Math.max(block.blockSize * scaleX, 1);
        const h = Math.max(block.blockSize * scaleY, 1);

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(x, y, w, h);
      }

      // 選択ポイント（黄色の円）
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      for (const point of selectedPoints) {
        ctx.beginPath();
        ctx.arc(point.x * scaleX, point.y * scaleY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // センターポイント（青い円）
      if (centerPoint) {
        ctx.strokeStyle = "#648cdc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerPoint.x * scaleX, centerPoint.y * scaleY, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }, [
      blocks,
      selectedPoints,
      centerPoint,
      selectedFactor,
      effectiveWidth,
      effectiveHeight,
      scaleX,
      scaleY,
      canvasSize.width,
      canvasSize.height,
    ]);

    /** canvas上のマウス座標を取得 */
    const getCanvasPosition = useCallback(
      (e: MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const displayScaleX = effectiveWidth / rect.width;
        const displayScaleY = effectiveHeight / rect.height;
        return {
          x: (e.clientX - rect.left) * displayScaleX,
          y: (e.clientY - rect.top) * displayScaleY,
        };
      },
      [effectiveWidth, effectiveHeight],
    );

    const handleMouseMove = useCallback(
      (e: MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasPosition(e);
        if (!pos) return;
        const block = findBlockAtPosition(pos.x, pos.y, blocks, scaleX, scaleY);
        setHoveredBlock(block);
      },
      [blocks, scaleX, scaleY, getCanvasPosition],
    );

    const handleMouseLeave = useCallback(() => setHoveredBlock(null), []);

    const handleClick = useCallback(
      (e: MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasPosition(e);
        if (!pos) return;
        const block = findBlockAtPosition(pos.x, pos.y, blocks, scaleX, scaleY);
        if (block) onBlockClick(block);
      },
      [blocks, scaleX, scaleY, getCanvasPosition, onBlockClick],
    );

    if (canvasSize.width === 0 || canvasSize.height === 0 || blocks.length === 0) {
      return <div className="text-muted-foreground text-sm italic">データなし</div>;
    }

    // maxValue（表示用）
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
          <canvas
            ref={canvasRef}
            className="w-full max-w-150 cursor-pointer rounded border"
            style={{
              aspectRatio: `${effectiveWidth} / ${effectiveHeight}`,
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />

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
