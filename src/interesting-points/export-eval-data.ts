import type {
  BlockDebugInfo,
  InterestingPointsDebugData,
} from "@/interesting-points/find-interesting-points";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getCanvasSize } from "@/rendering/renderer";
import { getStore } from "@/store/store";

/** scoreStatsの型 */
export interface ScoreStats {
  totalBlocks: number;
  nonZeroCount: number;
  min: number;
  max: number;
  mean: number;
}

/** summary.jsonの型 */
export interface EvalSummary {
  timestamp: string;
  params: { centerX: string; centerY: string; r: string; N: number };
  canvasSize: { width: number; height: number };
  scoring: string;
  selectedPoints: Array<{
    rank: number;
    x: number;
    y: number;
    iteration: number;
    score: number;
    factors: Record<string, number>;
  }>;
  scoreStats: ScoreStats;
}

/**
 * ブロックデバッグデータからスコア統計を算出する
 */
export const calcScoreStats = (blocks: BlockDebugInfo[]): ScoreStats => {
  if (blocks.length === 0) {
    return { totalBlocks: 0, nonZeroCount: 0, min: 0, max: 0, mean: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let nonZeroCount = 0;

  for (const block of blocks) {
    if (block.score > 0) {
      nonZeroCount++;
      if (block.score < min) min = block.score;
    }
    if (block.score > max) max = block.score;
    sum += block.score;
  }

  return {
    totalBlocks: blocks.length,
    nonZeroCount,
    min: nonZeroCount === 0 ? 0 : min,
    max: max === -Infinity ? 0 : max,
    mean: sum / blocks.length,
  };
};

/**
 * InterestingPointsDebugDataからEvalSummaryを生成する
 */
export const buildEvalSummary = (debugData: InterestingPointsDebugData): EvalSummary => {
  const params = getCurrentParams();
  const canvasSize = getCanvasSize();

  const allBlocks =
    debugData.scoring === "symmetry"
      ? debugData.gridBlocks
      : debugData.scaleBlocks.flatMap((sb) => sb.blocks);

  return {
    timestamp: new Date().toISOString(),
    params: {
      centerX: params.x.toString(),
      centerY: params.y.toString(),
      r: params.r.toString(),
      N: params.N,
    },
    canvasSize: { width: canvasSize.width, height: canvasSize.height },
    scoring: debugData.scoring,
    selectedPoints: debugData.selectedPoints.map((p, i) => {
      // 対応するブロックのfactorsを取得
      const matchingBlock = allBlocks.find((b) => b.peak && b.peak.x === p.x && b.peak.y === p.y);
      return {
        rank: i + 1,
        x: p.x,
        y: p.y,
        iteration: p.iteration,
        score: p.score,
        factors: matchingBlock?.factors ?? {},
      };
    }),
    scoreStats: calcScoreStats(allBlocks),
  };
};

const MARKER_BASE_RADIUS = 6;
const MARKER_MAX_RADIUS = 14;

/**
 * Canvas 2D APIでマーカーを描画する
 *
 * p5.jsに依存せず、drawUIInterestingPointsと同等の見た目を再現する。
 */
const drawMarkersOnCanvas = (
  ctx: CanvasRenderingContext2D,
  debugData: InterestingPointsDebugData,
  scaleX: number,
  scaleY: number,
) => {
  const points = debugData.selectedPoints;
  if (points.length === 0) return;

  const maxScore = points[0].score;

  for (const point of points) {
    const ratio = maxScore > 0 ? point.score / maxScore : 0;
    const radius = MARKER_BASE_RADIUS + (MARKER_MAX_RADIUS - MARKER_BASE_RADIUS) * ratio;
    const x = point.x * scaleX;
    const y = point.y * scaleY;

    // 黒の影
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.24)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 白リング
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgb(0, 0, 100)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

/**
 * 盤面画像にマーカーを合成したDataURLを生成する
 *
 * getResizedCanvasImageDataURLで取得した画像の上に選出ポイントのマーカーを描画する。
 */
export const createCompositeImage = (
  baseImageDataURL: string,
  debugData: InterestingPointsDebugData,
  canvasWidth: number,
  canvasHeight: number,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2d context"));
        return;
      }

      ctx.drawImage(img, 0, 0);

      const scaleX = img.width / canvasWidth;
      const scaleY = img.height / canvasHeight;
      drawMarkersOnCanvas(ctx, debugData, scaleX, scaleY);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load base image"));
    img.src = baseImageDataURL;
  });
};

/**
 * 評価データをローカルサーバーにエクスポートする
 *
 * 合成画像とsummary JSONを生成し、POST /api/eval-exportに送信する。
 * 保存されたpointIndexを返す。
 */
export const exportEvalData = async (getImageDataURL: () => Promise<string>): Promise<number> => {
  const debugData = getStore("interestingPointsDebugData");
  if (!debugData) {
    throw new Error("No debug data available");
  }

  const canvasSize = getCanvasSize();
  const baseImageDataURL = await getImageDataURL();
  const compositeImageDataURL = await createCompositeImage(
    baseImageDataURL,
    debugData,
    canvasSize.width,
    canvasSize.height,
  );

  const summary = buildEvalSummary(debugData);

  const response = await fetch("http://localhost:8080/api/eval-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: compositeImageDataURL,
      summary,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? "Export failed");
  }

  const result = (await response.json()) as { pointIndex: number };
  return result.pointIndex;
};
