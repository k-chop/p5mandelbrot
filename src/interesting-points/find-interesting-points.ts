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
  /** スコアリング方式。デフォルト 'symmetry' */
  scoring?: "symmetry" | "entropy-gradient";
  /** trueの場合、中間データを収集してデバッグ情報を返す */
  debug?: boolean;
}

/** デバッグ用のブロック情報 */
export interface BlockDebugInfo {
  /** ブロックの左上X座標 */
  bx: number;
  /** ブロックの左上Y座標 */
  by: number;
  /** ブロックサイズ（symmetryモードではstride値） */
  blockSize: number;
  /** スコアリング要因の個別値。キーはアルゴリズムに依存する */
  factors: Record<string, number>;
  /** 最終スコア */
  score: number;
  /** ピーク座標（存在する場合） */
  peak: { x: number; y: number; iteration: number } | null;
}

/** デバッグ用の中間データ */
export interface InterestingPointsDebugData {
  /** 使用されたスコアリング方式 */
  scoring: "symmetry" | "entropy-gradient";
  /** symmetryモード時のグリッド情報 */
  gridBlocks: BlockDebugInfo[];
  /** entropy-gradientモード時のスケールごとのブロック情報 */
  scaleBlocks: Array<{ scale: number; blocks: BlockDebugInfo[] }>;
  /** クラスタリング前の全候補 */
  rawCandidates: InterestingPoint[];
  /** クラスタリング後の全候補（topK適用前） */
  mergedCandidates: InterestingPoint[];
  /** 最終選出ポイント */
  selectedPoints: InterestingPoint[];
  /** 構造中心点（別枠選出）。周囲に放射状に高スコアが広がる収束点 */
  centerPoint: InterestingPoint | null;
}

/** findInterestingPointsの戻り値（debug: true時） */
export interface InterestingPointsDebugResult {
  points: InterestingPoint[];
  debugData: InterestingPointsDebugData;
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
  debugBlocks?: BlockDebugInfo[],
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

      if (debugBlocks) {
        const gradient = peak
          ? calcGradientMagnitude(buffer, peak.x, peak.y, width, height, maxIteration)
          : 0;
        const entropy = calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration);
        const score = peak ? entropy * Math.log2(1 + gradient) : 0;

        debugBlocks.push({
          bx,
          by,
          blockSize,
          factors: { entropy, gradient },
          score,
          peak: peak ? { x: peak.x, y: peak.y, iteration: peak.iteration } : null,
        });

        if (peak && score > 0) {
          candidates.push({ x: peak.x, y: peak.y, iteration: peak.iteration, score });
        }
      } else {
        if (!peak) continue;

        const gradient = calcGradientMagnitude(buffer, peak.x, peak.y, width, height, maxIteration);
        const entropy = calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration);

        const score = entropy * Math.log2(1 + gradient);
        if (score > 0) {
          candidates.push({ x: peak.x, y: peak.y, iteration: peak.iteration, score });
        }
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

/** 周辺構造密度の検査に使う半径リスト */
const NEIGHBORHOOD_RADII = [8, 16, 32, 64];

/** 周辺構造密度の各半径でのサンプル数 */
const NEIGHBORHOOD_SAMPLES_PER_RADIUS = 16;

/**
 * neighborhoodGradientの減衰係数。
 * structureAmountが極端に低い場合のみ救済するため、
 * max(structureAmount, neighborhoodGradient * WEIGHT) で適用する。
 */
const NEIGHBORHOOD_RESCUE_WEIGHT = 0.1;

/**
 * 中心点の周辺におけるgradient密度を算出する
 *
 * 複数半径の円周上でgradient magnitudeをサンプリングし、
 * 平均値をmaxIterationで正規化して返す。
 * 放射状構造の中心点のように局所的には平坦だが
 * 周囲に複雑な構造が広がっている場所を検出できる。
 */
export const calcNeighborhoodGradientDensity = (
  buffer: Uint32Array,
  cx: number,
  cy: number,
  width: number,
  height: number,
  maxIteration: number,
): number => {
  let totalGradient = 0;
  let sampleCount = 0;

  for (const r of NEIGHBORHOOD_RADII) {
    for (let k = 0; k < NEIGHBORHOOD_SAMPLES_PER_RADIUS; k++) {
      const angle = (2 * Math.PI * k) / NEIGHBORHOOD_SAMPLES_PER_RADIUS;
      const sx = Math.round(cx + r * Math.cos(angle));
      const sy = Math.round(cy + r * Math.sin(angle));

      if (sx < 1 || sx >= width - 1 || sy < 1 || sy >= height - 1) continue;

      const val = buffer[sy * width + sx];
      if (val === 0 || val === maxIteration) continue;

      const gradient = calcGradientMagnitude(buffer, sx, sy, width, height, maxIteration);
      totalGradient += gradient;
      sampleCount++;
    }
  }

  if (sampleCount === 0) return 0;

  return totalGradient / sampleCount / maxIteration;
};

/** 回転対称性の検査に使う半径リスト */
const SYMMETRY_RADII = [4, 8, 16, 32, 64, 96];

/** 円周サンプルのユニーク値がこの数未満なら対称性計算をスキップ（平坦領域の偽高スコアを防ぐ） */
const SYMMETRY_MIN_UNIQUE_VALUES = 3;

/** 回転次数の範囲 */
const MIN_ROTATION_ORDER = 2;
const MAX_ROTATION_ORDER = 8;

/**
 * Pearson相関係数を計算する
 *
 * 有効ペアが不足している場合は0を返す。
 */
const calcPearsonCorrelation = (xs: number[], ys: number[]): number => {
  const n = xs.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let covXY = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return 0;

  return covXY / denom;
};

/**
 * 指定した中心点における回転対称性スコアを計算する
 *
 * 複数の半径で円周上のiteration値をサンプリングし、
 * 各回転次数(2..8)でPearson相関を求めて最大値を取る。
 * 全半径の最大相関を平均し、構造量（標準偏差/maxIteration）と周辺構造密度の
 * 大きい方を乗じて最終スコアとする。
 */
export const calcRotationalSymmetry = (
  buffer: Uint32Array,
  cx: number,
  cy: number,
  width: number,
  height: number,
  maxIteration: number,
): number => {
  const correlations: number[] = [];
  let validRadiusCount = 0;
  let allValidSum = 0;
  let allValidSumSq = 0;
  let allValidCount = 0;

  for (const r of SYMMETRY_RADII) {
    const sampleCount = Math.max(16, Math.round((2 * Math.PI * r) / 2));
    const samples: number[] = [];
    const valid: boolean[] = [];

    for (let k = 0; k < sampleCount; k++) {
      const angle = (2 * Math.PI * k) / sampleCount;
      const sx = Math.round(cx + r * Math.cos(angle));
      const sy = Math.round(cy + r * Math.sin(angle));

      if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
        samples.push(0);
        valid.push(false);
      } else {
        const val = buffer[sy * width + sx];
        if (val === 0 || val === maxIteration) {
          samples.push(0);
          valid.push(false);
        } else {
          samples.push(val);
          valid.push(true);
          allValidSum += val;
          allValidSumSq += val * val;
          allValidCount++;
        }
      }
    }

    // 円周サンプルの変動係数が小さい（平坦）なら対称性0とみなす
    const validSamples = samples.filter((_, i) => valid[i]);
    let bestCorrelation = 0;

    if (validSamples.length >= 4) {
      const uniqueCount = new Set(validSamples).size;

      if (uniqueCount >= SYMMETRY_MIN_UNIQUE_VALUES) {
        for (let n = MIN_ROTATION_ORDER; n <= MAX_ROTATION_ORDER; n++) {
          const shift = Math.round(sampleCount / n);
          if (shift === 0) continue;

          const xs: number[] = [];
          const ys: number[] = [];

          for (let k = 0; k < sampleCount; k++) {
            const k2 = (k + shift) % sampleCount;
            if (valid[k] && valid[k2]) {
              xs.push(samples[k]);
              ys.push(samples[k2]);
            }
          }

          const minPairs = Math.floor(sampleCount / n / 2);
          if (xs.length < minPairs) continue;

          const correlation = calcPearsonCorrelation(xs, ys);
          if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
          }
        }
      }
    }

    correlations.push(bestCorrelation);
    validRadiusCount++;
  }

  if (validRadiusCount === 0 || allValidCount === 0) return 0;

  const sorted = [...correlations].sort((a, b) => a - b);
  const symmetryScore = sorted[Math.floor(sorted.length * 0.25)];

  const mean = allValidSum / allValidCount;
  const variance = allValidSumSq / allValidCount - mean * mean;
  const structureAmount = Math.sqrt(Math.max(0, variance)) / maxIteration;

  const neighborhoodGradient = calcNeighborhoodGradientDensity(
    buffer,
    cx,
    cy,
    width,
    height,
    maxIteration,
  );

  return (
    symmetryScore * Math.max(structureAmount, neighborhoodGradient * NEIGHBORHOOD_RESCUE_WEIGHT)
  );
};

/** calcRotationalSymmetryの分解結果 */
interface SymmetryFactors {
  symmetryScore: number;
  structureAmount: number;
  neighborhoodGradient: number;
  score: number;
}

/**
 * 回転対称性スコアの個別要因を返す
 *
 * calcRotationalSymmetryと同じ計算を行い、symmetryScore・structureAmount・neighborhoodGradientを個別に返す。
 */
const calcRotationalSymmetryFactors = (
  buffer: Uint32Array,
  cx: number,
  cy: number,
  width: number,
  height: number,
  maxIteration: number,
): SymmetryFactors => {
  const correlations: number[] = [];
  let validRadiusCount = 0;
  let allValidSum = 0;
  let allValidSumSq = 0;
  let allValidCount = 0;

  for (const r of SYMMETRY_RADII) {
    const sampleCount = Math.max(16, Math.round((2 * Math.PI * r) / 2));
    const samples: number[] = [];
    const valid: boolean[] = [];

    for (let k = 0; k < sampleCount; k++) {
      const angle = (2 * Math.PI * k) / sampleCount;
      const sx = Math.round(cx + r * Math.cos(angle));
      const sy = Math.round(cy + r * Math.sin(angle));

      if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
        samples.push(0);
        valid.push(false);
      } else {
        const val = buffer[sy * width + sx];
        if (val === 0 || val === maxIteration) {
          samples.push(0);
          valid.push(false);
        } else {
          samples.push(val);
          valid.push(true);
          allValidSum += val;
          allValidSumSq += val * val;
          allValidCount++;
        }
      }
    }

    // 円周サンプルの変動係数が小さい（平坦）なら対称性0とみなす
    const validSamples = samples.filter((_, i) => valid[i]);
    let bestCorrelation = 0;

    if (validSamples.length >= 4) {
      const uniqueCount = new Set(validSamples).size;

      if (uniqueCount >= SYMMETRY_MIN_UNIQUE_VALUES) {
        for (let n = MIN_ROTATION_ORDER; n <= MAX_ROTATION_ORDER; n++) {
          const shift = Math.round(sampleCount / n);
          if (shift === 0) continue;

          const xs: number[] = [];
          const ys: number[] = [];

          for (let k = 0; k < sampleCount; k++) {
            const k2 = (k + shift) % sampleCount;
            if (valid[k] && valid[k2]) {
              xs.push(samples[k]);
              ys.push(samples[k2]);
            }
          }

          const minPairs = Math.floor(sampleCount / n / 2);
          if (xs.length < minPairs) continue;

          const correlation = calcPearsonCorrelation(xs, ys);
          if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
          }
        }
      }
    }

    correlations.push(bestCorrelation);
    validRadiusCount++;
  }

  if (validRadiusCount === 0 || allValidCount === 0) {
    return { symmetryScore: 0, structureAmount: 0, neighborhoodGradient: 0, score: 0 };
  }

  const sorted = [...correlations].sort((a, b) => a - b);
  const symmetryScore = sorted[Math.floor(sorted.length * 0.25)];
  const mean = allValidSum / allValidCount;
  const variance = allValidSumSq / allValidCount - mean * mean;
  const structureAmount = Math.sqrt(Math.max(0, variance)) / maxIteration;

  const neighborhoodGradient = calcNeighborhoodGradientDensity(
    buffer,
    cx,
    cy,
    width,
    height,
    maxIteration,
  );

  return {
    symmetryScore,
    structureAmount,
    neighborhoodGradient,
    score:
      symmetryScore * Math.max(structureAmount, neighborhoodGradient * NEIGHBORHOOD_RESCUE_WEIGHT),
  };
};

/**
 * dense gridスキャンで回転対称性の候補を検出する
 *
 * stride間隔でグリッドスキャンし、各点でcalcRotationalSymmetryを計算。
 * スコア > 0 の候補を収集する。
 */
const findSymmetryCandidates = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  stride: number,
  minIteration: number,
  debugBlocks?: BlockDebugInfo[],
): InterestingPoint[] => {
  const candidates: InterestingPoint[] = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const iter = buffer[y * width + x];
      if (iter < minIteration && iter !== 0) continue;

      if (debugBlocks) {
        const factors = calcRotationalSymmetryFactors(buffer, x, y, width, height, maxIteration);
        debugBlocks.push({
          bx: x,
          by: y,
          blockSize: stride,
          factors: {
            symmetryScore: factors.symmetryScore,
            structureAmount: factors.structureAmount,
            neighborhoodGradient: factors.neighborhoodGradient,
          },
          score: factors.score,
          peak: { x, y, iteration: iter },
        });
        if (factors.score > 0) {
          candidates.push({ x, y, iteration: iter, score: factors.score });
        }
      } else {
        const score = calcRotationalSymmetry(buffer, x, y, width, height, maxIteration);
        if (score > 0) {
          candidates.push({ x, y, iteration: iter, score });
        }
      }
    }
  }

  return candidates;
};

/**
 * 近接する候補をクラスタリングし、各クラスタの最高スコア候補を返す
 *
 * スコア降順でgreedy clusteringを行い、proximityThreshold以内の候補は
 * 同一クラスタに統合される。
 */
export const mergeProximityCandidates = (
  candidates: InterestingPoint[],
  proximityThreshold: number,
): InterestingPoint[] => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const clusters: InterestingPoint[] = [];

  for (const candidate of sorted) {
    let merged = false;
    for (const cluster of clusters) {
      const dx = candidate.x - cluster.x;
      const dy = candidate.y - cluster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= proximityThreshold) {
        if (candidate.score > cluster.score) {
          cluster.x = candidate.x;
          cluster.y = candidate.y;
          cluster.iteration = candidate.iteration;
          cluster.score = candidate.score;
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({ ...candidate });
    }
  }

  return clusters.sort((a, b) => b.score - a.score);
};

/**
 * Greedy Non-Maximum Suppressionで空間的に分散したポイントを選出する
 *
 * スコア降順で1つずつ選出し、選出済みポイントからsuppressionRadius以内の
 * 候補を除外する。topK個に満たない場合はそのまま少なく返す。
 */
export const applyNMS = (
  candidates: InterestingPoint[],
  topK: number,
  suppressionRadius: number,
): InterestingPoint[] => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: InterestingPoint[] = [];

  for (const candidate of sorted) {
    if (selected.length >= topK) break;

    const isSuppressed = selected.some((s) => {
      const dx = candidate.x - s.x;
      const dy = candidate.y - s.y;
      return Math.sqrt(dx * dx + dy * dy) <= suppressionRadius;
    });

    if (!isSuppressed) {
      selected.push(candidate);
    }
  }

  return selected;
};

/** 中心点検出で使う方向数 */
const CENTER_DIRECTIONS = 16;

/** 中心点検出のサンプリング半径（ピクセル単位） */
const CENTER_RADII = [16, 32, 48, 64, 80, 96, 112, 128];

/** 中心点と認めるための最低方位カバレッジ（0-1）。半数以上の方向に構造が必要 */
const CENTER_MIN_COVERAGE = 0.5;

/** エロージョンの最大ラウンド数。ピークが1つになったら早期停止する */
const CENTER_EROSION_MAX_ROUNDS = 50;

/**
 * ある点を中心として、周囲の方位に構造がどれだけ広く分布しているかを算出する
 *
 * CENTER_DIRECTIONS方向 × CENTER_RADII半径でスコアグリッドをサンプリングし、
 * rank正規化されたスコアグリッドをサンプリングし、
 * coverage（構造がある方向の割合）とdensity（サンプルのrank値平均）を返す。
 * centerScore = coverage × density で、広い構造の中心ほど高くなる。
 */
const calcStructureCenterScore = (
  cx: number,
  cy: number,
  rankGrid: Map<string, number>,
  stride: number,
): { coverage: number; centerScore: number } => {
  let directionsWithStructure = 0;
  let totalRankSum = 0;
  const totalProbes = CENTER_DIRECTIONS * CENTER_RADII.length;

  for (let d = 0; d < CENTER_DIRECTIONS; d++) {
    const angle = (2 * Math.PI * d) / CENTER_DIRECTIONS;
    let foundInDirection = false;

    for (const r of CENTER_RADII) {
      const sx = Math.round(cx + r * Math.cos(angle));
      const sy = Math.round(cy + r * Math.sin(angle));
      // グリッドにスナップ
      const gx = Math.round(sx / stride) * stride;
      const gy = Math.round(sy / stride) * stride;
      const rank = rankGrid.get(`${gx},${gy}`) ?? 0;

      totalRankSum += rank;
      if (rank > 0) {
        foundInDirection = true;
      }
    }

    if (foundInDirection) directionsWithStructure++;
  }

  const coverage = directionsWithStructure / CENTER_DIRECTIONS;
  const density = totalRankSum / totalProbes;

  return { coverage, centerScore: coverage * density };
};

/**
 * グリッド上で閾値以上のスコアを持つブロックの連結成分数を数える（4近傍flood fill）
 */
const countConnectedComponents = (
  blocks: BlockDebugInfo[],
  grid: Map<string, number>,
  stride: number,
  threshold: number,
): number => {
  const visited = new Set<string>();
  let count = 0;

  for (const block of blocks) {
    const key = `${block.bx},${block.by}`;
    if (visited.has(key)) continue;
    if ((grid.get(key) ?? 0) < threshold) continue;

    // flood fill
    count++;
    const stack = [key];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const [cx, cy] = current.split(",").map(Number);
      for (const [nx, ny] of [
        [cx, cy - stride],
        [cx, cy + stride],
        [cx - stride, cy],
        [cx + stride, cy],
      ]) {
        const nKey = `${nx},${ny}`;
        if (!visited.has(nKey) && (grid.get(nKey) ?? 0) >= threshold) {
          stack.push(nKey);
        }
      }
    }
  }

  return count;
};

/** structureAmountの島の重心でcenterPointの位置を補正する比率 */
const STRUCTURE_ISLAND_THRESHOLD = 0.5;

/**
 * 仮centerPointに最も近いstructureAmountの島（連続した高スコア領域）を
 * flood fillで特定し、島内のstructureAmountで重み付き重心を返す。
 * 島が見つからない場合は元の座標をそのまま返す。
 */
const adjustCenterByStructureIsland = (
  blocks: BlockDebugInfo[],
  cx: number,
  cy: number,
  stride: number,
): { x: number; y: number } => {
  // structureAmountのグリッドを構築
  const saGrid = new Map<string, number>();
  for (const block of blocks) {
    saGrid.set(`${block.bx},${block.by}`, block.factors.structureAmount ?? 0);
  }

  // 仮centerPointに最も近いブロックを探す
  let closestKey = "";
  let closestDist = Infinity;
  for (const block of blocks) {
    const dx = block.bx - cx;
    const dy = block.by - cy;
    const dist = dx * dx + dy * dy;
    if (dist < closestDist) {
      closestDist = dist;
      closestKey = `${block.bx},${block.by}`;
    }
  }

  const startSa = saGrid.get(closestKey) ?? 0;
  if (startSa === 0) return { x: cx, y: cy };

  // flood fillで島を特定（島内の最大値の50%以上を閾値とする）
  // まず島全体を探索して最大値を求め、その後閾値でフィルタする
  const visited = new Set<string>();
  const islandKeys: string[] = [];
  const queue: string[] = [closestKey];
  visited.add(closestKey);

  // 第1パス: structureAmount > 0 の連続領域を探索
  while (queue.length > 0) {
    const key = queue.shift()!;
    islandKeys.push(key);

    const [bxStr, byStr] = key.split(",");
    const bx = Number(bxStr);
    const by = Number(byStr);

    for (const [nx, ny] of [
      [bx - stride, by],
      [bx + stride, by],
      [bx, by - stride],
      [bx, by + stride],
    ]) {
      const nKey = `${nx},${ny}`;
      if (visited.has(nKey)) continue;
      const nSa = saGrid.get(nKey) ?? 0;
      if (nSa > 0) {
        visited.add(nKey);
        queue.push(nKey);
      }
    }
  }

  if (islandKeys.length === 0) return { x: cx, y: cy };

  // 島内の最大structureAmountを求め、閾値でフィルタ
  let maxSa = 0;
  for (const key of islandKeys) {
    const sa = saGrid.get(key)!;
    if (sa > maxSa) maxSa = sa;
  }
  const threshold = maxSa * STRUCTURE_ISLAND_THRESHOLD;

  // 閾値以上のブロックでstructureAmount重み付き重心を計算
  let wX = 0;
  let wY = 0;
  let wTotal = 0;
  for (const key of islandKeys) {
    const sa = saGrid.get(key)!;
    if (sa < threshold) continue;
    const [bxStr, byStr] = key.split(",");
    wX += Number(bxStr) * sa;
    wY += Number(byStr) * sa;
    wTotal += sa;
  }

  if (wTotal === 0) return { x: cx, y: cy };

  return {
    x: Math.round(wX / wTotal),
    y: Math.round(wY / wTotal),
  };
};

/**
 * ブロックスコア分布から構造の中心点を検出する
 *
 * 各グリッド位置のcenterScore（coverage × density）を算出した後、
 * エロージョン（収縮）を適用して小さいピークを除去する（ピークが1つになるまで）。
 * エロージョン後のスコアをfactorsに記録（ヒートマップ出力用）し、
 * 高スコアブロック群（最大値の90%以上）の重み付き重心を中心点とする。
 * 最後にstructureAmountの島の重心で補正する。
 */
export const findStructureCenter = (
  blocks: BlockDebugInfo[],
  stride: number,
): InterestingPoint | null => {
  if (blocks.length === 0) return null;

  // rank正規化グリッドを構築（スコア順位を0-1に正規化）
  const sorted = blocks
    .map((b) => ({ key: `${b.bx},${b.by}`, score: b.score }))
    .sort((a, b) => a.score - b.score);
  const rankGrid = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    // スコア0のブロックはrank 0
    const rank = sorted[i].score > 0 ? (i + 1) / sorted.length : 0;
    rankGrid.set(sorted[i].key, rank);
  }

  // 全ブロックのcenterScoreを算出してfactorsに記録
  let maxCenterScore = 0;
  for (const block of blocks) {
    const { coverage, centerScore } = calcStructureCenterScore(
      block.bx,
      block.by,
      rankGrid,
      stride,
    );

    block.factors.centerScore = coverage >= CENTER_MIN_COVERAGE ? centerScore : 0;
    if (block.factors.centerScore > maxCenterScore) {
      maxCenterScore = block.factors.centerScore;
    }
  }

  if (maxCenterScore === 0) return null;

  // エロージョン: 各ラウンドで各ブロックのスコアを自分と上下左右の最小値に置き換える
  // 小さいピークが消え、大きいピークの中心部だけが残る
  // ピークが1つになったら停止、全消滅なら1つ前の状態を採用
  const centerScoreGrid = new Map<string, number>();
  for (const block of blocks) {
    centerScoreGrid.set(`${block.bx},${block.by}`, block.factors.centerScore);
  }

  let lastGoodGrid = new Map(centerScoreGrid);

  for (let round = 0; round < CENTER_EROSION_MAX_ROUNDS; round++) {
    const prevGrid = new Map(centerScoreGrid);
    for (const block of blocks) {
      const { bx, by } = block;
      const self = prevGrid.get(`${bx},${by}`) ?? 0;
      const up = prevGrid.get(`${bx},${by - stride}`) ?? 0;
      const down = prevGrid.get(`${bx},${by + stride}`) ?? 0;
      const left = prevGrid.get(`${bx - stride},${by}`) ?? 0;
      const right = prevGrid.get(`${bx + stride},${by}`) ?? 0;
      const eroded = Math.min(self, up, down, left, right);
      centerScoreGrid.set(`${bx},${by}`, eroded);
    }

    // ピーク判定: 現在の最大値の50%以上をピークとみなして連結成分を数える
    let currentMax = 0;
    for (const val of centerScoreGrid.values()) {
      if (val > currentMax) currentMax = val;
    }
    const peakThreshold = currentMax * 0.5;
    const peakCount =
      peakThreshold > 0
        ? countConnectedComponents(blocks, centerScoreGrid, stride, peakThreshold)
        : 0;

    if (peakCount === 0) {
      // 全消滅 → 1つ前の状態を採用
      for (const [key, val] of lastGoodGrid) {
        centerScoreGrid.set(key, val);
      }
      break;
    }

    lastGoodGrid = new Map(centerScoreGrid);

    if (peakCount === 1) {
      break;
    }
  }

  // エロージョン後のスコアをfactorsに書き戻し（ヒートマップ反映）
  let maxErodedScore = 0;
  for (const block of blocks) {
    block.factors.centerScore = centerScoreGrid.get(`${block.bx},${block.by}`) ?? 0;
    if (block.factors.centerScore > maxErodedScore) {
      maxErodedScore = block.factors.centerScore;
    }
  }

  if (maxErodedScore === 0) return null;

  // 最大centerScoreの90%以上のブロックで重み付き重心を計算
  const centroidThreshold = maxErodedScore * 0.9;
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  for (const block of blocks) {
    const cs = block.factors.centerScore;
    if (cs < centroidThreshold) continue;

    // bx/byはサンプリング点そのもの（ブロック左上角ではない）なのでオフセット不要
    weightedX += block.bx * cs;
    weightedY += block.by * cs;
    totalWeight += cs;
  }

  if (totalWeight === 0) return null;

  const cx = Math.round(weightedX / totalWeight);
  const cy = Math.round(weightedY / totalWeight);

  // structureAmountの島の重心で補正
  const adjusted = adjustCenterByStructureIsland(blocks, cx, cy, stride);

  return {
    x: adjusted.x,
    y: adjusted.y,
    iteration: 0,
    score: maxErodedScore,
  };
};

/**
 * iterationバッファから興味深いポイントを検出する
 *
 * スコアリング方式:
 * - 'symmetry'（デフォルト）: 回転対称性に基づく検出
 * - 'entropy-gradient': entropy × gradient に基づく検出（blockSize/scales指定時も自動選択）
 *
 * blockSize指定時は単一スケールで後方互換動作する。
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
  const topK = options?.topK ?? 5;
  const minIteration = options?.minIteration ?? 10;
  const debug = options?.debug ?? false;
  const suppressionRadius = Math.min(width, height) * 0.15;

  // スコアリング方式の決定:
  // blockSize指定 → entropy-gradient
  // scales指定 → entropy-gradient
  // scoring: 'entropy-gradient' → entropy-gradient
  // それ以外（デフォルト） → symmetry
  const useSymmetry =
    options?.scoring === "symmetry" ||
    (options?.scoring == null && options?.blockSize == null && options?.scales == null);

  if (useSymmetry) {
    const debugBlocks: BlockDebugInfo[] | undefined = debug ? [] : undefined;
    const candidates = findSymmetryCandidates(
      buffer,
      width,
      height,
      maxIteration,
      8,
      minIteration,
      debugBlocks,
    );
    const merged = mergeProximityCandidates(candidates, 16);
    const selected = applyNMS(merged, topK, suppressionRadius);

    if (debug) {
      const centerPoint = findStructureCenter(debugBlocks!, 8);
      return {
        points: selected,
        debugData: {
          scoring: "symmetry",
          gridBlocks: debugBlocks!,
          scaleBlocks: [],
          rawCandidates: candidates,
          mergedCandidates: merged,
          selectedPoints: selected,
          centerPoint,
        },
      };
    }

    return selected;
  }

  // entropy-gradient パス
  const scales =
    options?.scales ?? (options?.blockSize != null ? [options.blockSize] : DEFAULT_SCALES);

  const perScaleLimit = topK * 3;
  const allCandidates: ScaledCandidate[] = [];
  const debugScaleBlocks: Array<{ scale: number; blocks: BlockDebugInfo[] }> = [];

  for (const scale of scales) {
    const debugBlocks: BlockDebugInfo[] | undefined = debug ? [] : undefined;
    const candidates = findCandidatesAtScale(
      buffer,
      width,
      height,
      maxIteration,
      scale,
      minIteration,
      debugBlocks,
    );
    candidates.sort((a, b) => b.score - a.score);
    const limited = candidates.slice(0, perScaleLimit);
    for (const c of limited) {
      allCandidates.push({ ...c, scale });
    }
    if (debug) {
      debugScaleBlocks.push({ scale, blocks: debugBlocks! });
    }
  }

  const rawCandidates = allCandidates.map(({ scale: _, ...rest }) => rest);

  if (scales.length === 1) {
    // 単一スケール: クラスタリングなし
    const singleScaleCandidates = allCandidates.map(({ scale: _, ...rest }) => rest);
    const selected = applyNMS(singleScaleCandidates, topK, suppressionRadius);

    if (debug) {
      return {
        points: selected,
        debugData: {
          scoring: "entropy-gradient",
          gridBlocks: [],
          scaleBlocks: debugScaleBlocks,
          rawCandidates,
          mergedCandidates: singleScaleCandidates,
          selectedPoints: selected,
          centerPoint: null,
        },
      };
    }

    return selected;
  }

  const proximityThreshold = Math.max(...scales) / 2;
  const merged = mergeCandidatesAcrossScales(allCandidates, proximityThreshold);
  const selected = applyNMS(merged, topK, suppressionRadius);

  if (debug) {
    return {
      points: selected,
      debugData: {
        scoring: "entropy-gradient",
        gridBlocks: [],
        scaleBlocks: debugScaleBlocks,
        rawCandidates,
        mergedCandidates: merged,
        selectedPoints: selected,
        centerPoint: null,
      },
    };
  }

  return selected;
}
