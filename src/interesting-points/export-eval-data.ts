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
  p50: number;
  p90: number;
  p99: number;
}

/** ポイントデータの型 */
export interface EvalPointData {
  rank: number;
  x: number;
  y: number;
  iteration: number;
  score: number;
  factors: Record<string, number>;
}

/** summary.jsonの型 */
export interface EvalSummary {
  timestamp: string;
  params: { centerX: string; centerY: string; r: string; N: number };
  canvasSize: { width: number; height: number };
  scoring: string;
  selectedPoints: EvalPointData[];
  nearMissPoints: EvalPointData[];
  centerPoint: EvalPointData | null;
  scoreStats: ScoreStats;
}

/**
 * ソート済み配列からパーセンタイル値を取得する
 */
const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

/**
 * ブロックデバッグデータからスコア統計を算出する
 */
export const calcScoreStats = (blocks: BlockDebugInfo[]): ScoreStats => {
  if (blocks.length === 0) {
    return { totalBlocks: 0, nonZeroCount: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p99: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let nonZeroCount = 0;

  const scores: number[] = [];
  for (const block of blocks) {
    scores.push(block.score);
    if (block.score > 0) {
      nonZeroCount++;
      if (block.score < min) min = block.score;
    }
    if (block.score > max) max = block.score;
    sum += block.score;
  }

  scores.sort((a, b) => a - b);

  return {
    totalBlocks: blocks.length,
    nonZeroCount,
    min: nonZeroCount === 0 ? 0 : min,
    max: max === -Infinity ? 0 : max,
    mean: sum / blocks.length,
    p50: percentile(scores, 50),
    p90: percentile(scores, 90),
    p99: percentile(scores, 99),
  };
};

/**
 * debugDataから全ブロックの統合配列を取得する
 */
const getAllBlocks = (debugData: InterestingPointsDebugData): BlockDebugInfo[] =>
  debugData.scoring === "symmetry"
    ? debugData.gridBlocks
    : debugData.scaleBlocks.flatMap((sb) => sb.blocks);

/**
 * ポイントに対応するブロックのfactorsを取得してEvalPointDataを生成する
 */
const toEvalPointData = (
  p: { x: number; y: number; iteration: number; score: number },
  rank: number,
  allBlocks: BlockDebugInfo[],
): EvalPointData => {
  const matchingBlock = allBlocks.find((b) => b.peak && b.peak.x === p.x && b.peak.y === p.y);
  return {
    rank,
    x: p.x,
    y: p.y,
    iteration: p.iteration,
    score: p.score,
    factors: matchingBlock?.factors ?? {},
  };
};

/**
 * InterestingPointsDebugDataからEvalSummaryを生成する
 */
export const buildEvalSummary = (
  debugData: InterestingPointsDebugData,
  allBlocks?: BlockDebugInfo[],
): EvalSummary => {
  const params = getCurrentParams();
  const canvasSize = getCanvasSize();

  const blocks = allBlocks ?? getAllBlocks(debugData);

  const selectedSet = new Set(debugData.selectedPoints.map((p) => `${p.x},${p.y}`));

  // mergedCandidatesからselectedPointsを除外し、スコア降順でrank 6-10を取得
  const nearMiss = debugData.mergedCandidates
    .filter((p) => !selectedSet.has(`${p.x},${p.y}`))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const selectedCount = debugData.selectedPoints.length;

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
    selectedPoints: debugData.selectedPoints.map((p, i) => toEvalPointData(p, i + 1, blocks)),
    nearMissPoints: nearMiss.map((p, i) => toEvalPointData(p, selectedCount + i + 1, blocks)),
    centerPoint: debugData.centerPoint
      ? toEvalPointData(debugData.centerPoint, 0, blocks)
      : null,
    scoreStats: calcScoreStats(blocks),
  };
};

/**
 * スコア値(0-1)をヒートマップ色(RGB)に変換する
 *
 * 0=黒 → 青 → シアン → 緑 → 黄 → 赤 → 白のグラデーション。
 */
const scoreToColor = (t: number): [number, number, number] => {
  if (t <= 0) return [0, 0, 0];
  if (t >= 1) return [255, 255, 255];

  // 5段階のグラデーション
  if (t < 0.2) {
    const s = t / 0.2;
    return [0, 0, Math.round(s * 255)];
  }
  if (t < 0.4) {
    const s = (t - 0.2) / 0.2;
    return [0, Math.round(s * 255), 255];
  }
  if (t < 0.6) {
    const s = (t - 0.4) / 0.2;
    return [0, 255, Math.round(255 * (1 - s))];
  }
  if (t < 0.8) {
    const s = (t - 0.6) / 0.2;
    return [Math.round(s * 255), 255, 0];
  }
  const s = (t - 0.8) / 0.2;
  return [255, Math.round(255 * (1 - s)), 0];
};

/**
 * ブロックスコアからヒートマップ画像のDataURLを生成する
 *
 * 各ブロックのスコアを正規化し、色に変換してキャンバスに描画する。
 */
export const createHeatmapImage = (
  blocks: BlockDebugInfo[],
  canvasWidth: number,
  canvasHeight: number,
): string => {
  return createHeatmapFromValues(
    blocks.map((b) => ({ bx: b.bx, by: b.by, blockSize: b.blockSize, value: b.score })),
    canvasWidth,
    canvasHeight,
  );
};

/**
 * 値の配列からヒートマップ画像のDataURLを生成する
 *
 * 各ブロックの値を最大値で正規化し、色に変換してキャンバスに描画する。
 */
const createHeatmapFromValues = (
  entries: { bx: number; by: number; blockSize: number; value: number }[],
  canvasWidth: number,
  canvasHeight: number,
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context for heatmap");

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (entries.length === 0) return canvas.toDataURL("image/png");

  let maxValue = 0;
  for (const entry of entries) {
    if (entry.value > maxValue) maxValue = entry.value;
  }
  if (maxValue === 0) return canvas.toDataURL("image/png");

  for (const entry of entries) {
    const t = entry.value / maxValue;
    const [r, g, b] = scoreToColor(t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(entry.bx, entry.by, entry.blockSize, entry.blockSize);
  }

  return canvas.toDataURL("image/png");
};

/**
 * 特定のfactorキーについてヒートマップ画像のDataURLを生成する
 *
 * ブロックのfactors内の指定キーの値を使ってヒートマップを描画する。
 */
export const createFactorHeatmapImage = (
  blocks: BlockDebugInfo[],
  factorKey: string,
  canvasWidth: number,
  canvasHeight: number,
): string => {
  return createHeatmapFromValues(
    blocks.map((b) => ({
      bx: b.bx,
      by: b.by,
      blockSize: b.blockSize,
      value: b.factors[factorKey] ?? 0,
    })),
    canvasWidth,
    canvasHeight,
  );
};

/**
 * 全factorキーのヒートマップを一括生成する
 *
 * ブロック群からfactorキーの一覧を抽出し、各factorのヒートマップDataURLをRecord形式で返す。
 */
export const createAllFactorHeatmaps = (
  blocks: BlockDebugInfo[],
  canvasWidth: number,
  canvasHeight: number,
): Record<string, string> => {
  const factorKeys = new Set<string>();
  for (const block of blocks) {
    for (const key of Object.keys(block.factors)) {
      factorKeys.add(key);
    }
  }

  const result: Record<string, string> = {};
  for (const key of factorKeys) {
    result[key] = createFactorHeatmapImage(blocks, key, canvasWidth, canvasHeight);
  }
  return result;
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

  if (points.length > 0) {
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
  }

  // 構造中心点（黄色のダイヤモンド）
  if (debugData.centerPoint) {
    const x = debugData.centerPoint.x * scaleX;
    const y = debugData.centerPoint.y * scaleY;
    const r = MARKER_MAX_RADIUS;

    // 黒の影
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 黄色のダイヤモンド
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.strokeStyle = "rgb(255, 220, 0)";
    ctx.lineWidth = 2;
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
 * 合成画像・ヒートマップ・summary JSONを生成し、POST /api/eval-exportに送信する。
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

  const allBlocks = getAllBlocks(debugData);

  const heatmapDataURL = createHeatmapImage(allBlocks, canvasSize.width, canvasSize.height);
  const factorHeatmaps = createAllFactorHeatmaps(allBlocks, canvasSize.width, canvasSize.height);
  const summary = buildEvalSummary(debugData, allBlocks);

  const response = await fetch("http://localhost:8080/api/eval-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: compositeImageDataURL,
      heatmap: heatmapDataURL,
      factorHeatmaps,
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
