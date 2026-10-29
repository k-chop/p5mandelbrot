import { findPeaks, peakMapToDebugBlocks } from "./peak-detector";

export interface InterestingPoint {
  x: number;
  y: number;
  iteration: number;
  score: number;
}

export interface FindInterestingPointsOptions {
  /** trueの場合、中間データを収集してデバッグ情報を返す */
  debug?: boolean;
}

/** デバッグ用のブロック情報 */
export interface BlockDebugInfo {
  /** ブロックの左上X座標 */
  bx: number;
  /** ブロックの左上Y座標 */
  by: number;
  blockSize: number;
  /** スコアリング要因の個別値。キーはアルゴリズムに依存する */
  factors: Record<string, number>;
  /** 最終スコア */
  score: number;
}

/** デバッグ用の中間データ */
export interface InterestingPointsDebugData {
  /** スコアマップのグリッド情報 */
  gridBlocks: BlockDebugInfo[];
  /** 最終選出ポイント */
  selectedPoints: InterestingPoint[];
}

/** findInterestingPointsの戻り値（debug: true時） */
export interface InterestingPointsDebugResult {
  points: InterestingPoint[];
  debugData: InterestingPointsDebugData;
}

/**
 * iterationバッファから興味深いポイントを検出する（多スケールのピーク検出、peak-detector.ts）
 *
 * debug: trueの場合、InterestingPointsDebugResultを返す。
 */
export function findInterestingPoints(
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options: FindInterestingPointsOptions & { debug: true },
): InterestingPointsDebugResult;
export function findInterestingPoints(
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: FindInterestingPointsOptions,
): InterestingPoint[];
export function findInterestingPoints(
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: FindInterestingPointsOptions,
): InterestingPoint[] | InterestingPointsDebugResult {
  const { points, map } = findPeaks(buffer, width, height, maxIteration);
  if (options?.debug) {
    return {
      points,
      debugData: { gridBlocks: peakMapToDebugBlocks(map), selectedPoints: points },
    };
  }
  return points;
}
