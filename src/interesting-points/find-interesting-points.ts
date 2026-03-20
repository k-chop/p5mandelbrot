export interface InterestingPoint {
  x: number;
  y: number;
  iteration: number;
  score: number;
}

export interface FindInterestingPointsOptions {
  blockSize?: number;
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

/**
 * iterationバッファから興味深いポイントを検出する
 *
 * グリッドベースのピーク検出と勾配スコアリングにより、
 * 集合の境界付近の視覚的に複雑な領域を特定する。
 */
export const findInterestingPoints = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: FindInterestingPointsOptions,
): InterestingPoint[] => {
  const blockSize = options?.blockSize ?? 32;
  const topK = options?.topK ?? 5;
  const minIteration = options?.minIteration ?? 10;

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

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topK);
};
