export interface InterestingPoint {
  x: number;
  y: number;
  iteration: number;
  score: number;
}

export interface FindInterestingPointsOptions {
  /** scalesが指定されたら無視される */
  blockSize?: number;
  /** マルチスケール検出に使うブロックサイズ配列。デフォルト [64, 32, 16] */
  scales?: number[];
  topK?: number;
  minIteration?: number;
}

/**
 * 周囲8方向のiteration差から勾配の大きさを算出する
 */
export const calcGradientMagnitude = (
  buffer: Uint32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  maxIteration: number,
): number => {
  const center = buffer[y * width + x];
  if (center === 0 || center === maxIteration) return 0;

  let sumSq = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;

      let neighbor: number;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        neighbor = center;
      } else {
        neighbor = buffer[ny * width + nx];
        if (neighbor === 0 || neighbor === maxIteration) {
          neighbor = center;
        }
      }

      const diff = center - neighbor;
      sumSq += diff * diff;
    }
  }

  return Math.sqrt(sumSq);
};

/**
 * ブロック内のiteration値のShannon entropyを算出する
 *
 * H = −Σ (count_i / total) × log₂(count_i / total) を計算し、
 * log₂(validCount) で正規化して 0〜1 の範囲に収める。
 * 値の分布の偏りまで反映したスコアリングが可能。
 */
export const calcLocalEntropy = (
  buffer: Uint32Array,
  bx: number,
  by: number,
  blockSize: number,
  width: number,
  height: number,
  maxIteration: number,
): number => {
  const counts = new Map<number, number>();
  let validCount = 0;

  const endX = Math.min(bx + blockSize, width);
  const endY = Math.min(by + blockSize, height);

  for (let py = by; py < endY; py++) {
    for (let px = bx; px < endX; px++) {
      const iter = buffer[py * width + px];
      if (iter === 0 || iter === maxIteration) continue;

      counts.set(iter, (counts.get(iter) ?? 0) + 1);
      validCount++;
    }
  }

  if (validCount <= 1) return 0;

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / validCount;
    entropy -= p * Math.log2(p);
  }

  return entropy / Math.log2(validCount);
};

interface BlockPeak {
  x: number;
  y: number;
  iteration: number;
}

/**
 * ブロック内で最大iteration値のピクセルを見つける
 */
export const findBlockPeak = (
  buffer: Uint32Array,
  bx: number,
  by: number,
  blockSize: number,
  width: number,
  height: number,
  maxIteration: number,
  minIteration: number,
): BlockPeak | null => {
  let bestX = -1;
  let bestY = -1;
  let bestIter = -1;

  const endX = Math.min(bx + blockSize, width);
  const endY = Math.min(by + blockSize, height);

  for (let py = by; py < endY; py++) {
    for (let px = bx; px < endX; px++) {
      const iter = buffer[py * width + px];
      if (iter === 0 || iter === maxIteration) continue;
      if (iter < minIteration) continue;

      if (iter > bestIter) {
        bestIter = iter;
        bestX = px;
        bestY = py;
      }
    }
  }

  if (bestX === -1) return null;

  return { x: bestX, y: bestY, iteration: bestIter };
};

/** マルチスケールブースト係数。3スケール全出現で2倍 */
const MULTI_SCALE_BOOST = 0.5;

/** デフォルトのスケール配列 */
const DEFAULT_SCALES = [64, 32, 16];

/** スケール情報付きの候補 */
interface ScaledCandidate extends InterestingPoint {
  scale: number;
}

/**
 * 指定blockSizeで全候補（score > 0）を返す
 *
 * topKフィルタリングは行わない。
 */
export const findCandidatesAtScale = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  blockSize: number,
  minIteration: number,
): InterestingPoint[] => {
  const candidates: InterestingPoint[] = [];

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const peak = findBlockPeak(
        buffer,
        bx,
        by,
        blockSize,
        width,
        height,
        maxIteration,
        minIteration,
      );
      if (!peak) continue;

      const gradient = calcGradientMagnitude(buffer, peak.x, peak.y, width, height, maxIteration);
      const entropy = calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration);

      const score = entropy * gradient;
      if (score > 0) {
        candidates.push({
          x: peak.x,
          y: peak.y,
          iteration: peak.iteration,
          score,
        });
      }
    }
  }

  return candidates;
};

/** クラスタリング結果 */
interface Cluster {
  x: number;
  y: number;
  iteration: number;
  maxScore: number;
  scales: Set<number>;
}

/**
 * 複数スケールの候補を近接クラスタリングし、スケール横断ブーストを適用する
 *
 * アルゴリズム:
 * 1. 全候補をスコア降順ソート
 * 2. 上位から処理: 既存クラスタ中心からproximityThreshold以内なら合流、なければ新クラスタ
 * 3. finalScore = maxScore × (1 + MULTI_SCALE_BOOST × (uniqueScaleCount - 1))
 */
export const mergeCandidatesAcrossScales = (
  candidates: ScaledCandidate[],
  proximityThreshold: number,
): InterestingPoint[] => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const clusters: Cluster[] = [];

  for (const candidate of sorted) {
    let merged = false;
    for (const cluster of clusters) {
      const dx = candidate.x - cluster.x;
      const dy = candidate.y - cluster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= proximityThreshold) {
        cluster.scales.add(candidate.scale);
        if (candidate.score > cluster.maxScore) {
          cluster.maxScore = candidate.score;
          cluster.x = candidate.x;
          cluster.y = candidate.y;
          cluster.iteration = candidate.iteration;
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        x: candidate.x,
        y: candidate.y,
        iteration: candidate.iteration,
        maxScore: candidate.score,
        scales: new Set([candidate.scale]),
      });
    }
  }

  return clusters
    .map((cluster) => ({
      x: cluster.x,
      y: cluster.y,
      iteration: cluster.iteration,
      score: cluster.maxScore * (1 + MULTI_SCALE_BOOST * (cluster.scales.size - 1)),
    }))
    .sort((a, b) => b.score - a.score);
};

/**
 * iterationバッファから興味深いポイントを検出する
 *
 * 複数のブロックサイズ（デフォルト 64, 32, 16）でスコアリングし、
 * スケール横断で安定して高スコアな点を優先する。
 * blockSize指定時は単一スケールで後方互換動作する。
 */
export const findInterestingPoints = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: FindInterestingPointsOptions,
): InterestingPoint[] => {
  const topK = options?.topK ?? 5;
  const minIteration = options?.minIteration ?? 10;

  // scales指定 → マルチスケール、blockSize指定 → 単一スケール、両方なし → デフォルトマルチスケール
  const scales =
    options?.scales ?? (options?.blockSize != null ? [options.blockSize] : DEFAULT_SCALES);

  const perScaleLimit = topK * 3;
  const allCandidates: ScaledCandidate[] = [];

  for (const scale of scales) {
    const candidates = findCandidatesAtScale(
      buffer,
      width,
      height,
      maxIteration,
      scale,
      minIteration,
    );
    candidates.sort((a, b) => b.score - a.score);
    const limited = candidates.slice(0, perScaleLimit);
    for (const c of limited) {
      allCandidates.push({ ...c, scale });
    }
  }

  if (scales.length === 1) {
    // 単一スケール: クラスタリングなし（後方互換）
    allCandidates.sort((a, b) => b.score - a.score);
    return allCandidates.slice(0, topK).map(({ scale: _, ...rest }) => rest);
  }

  const proximityThreshold = Math.max(...scales) / 2;
  const merged = mergeCandidatesAcrossScales(allCandidates, proximityThreshold);
  return merged.slice(0, topK);
};
