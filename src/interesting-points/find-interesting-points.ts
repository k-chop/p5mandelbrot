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

const DEFAULT_SEARCH_RADIUS = 16;

/**
 * 指定座標から最も近いiteration===maxIterationのピクセルまでの距離に基づくスコアを算出する
 *
 * 集合の境界に近いほど高い値を返す。
 * 見つかれば `1 / (1 + distance)`、searchRadius内に無ければ `1 / (1 + searchRadius)`。
 */
export const calcBoundaryProximity = (
  buffer: Uint32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  maxIteration: number,
  searchRadius: number = DEFAULT_SEARCH_RADIUS,
): number => {
  for (let d = 1; d <= searchRadius; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        if (buffer[ny * width + nx] === maxIteration) {
          return 1 / (1 + d);
        }
      }
    }
  }

  return 1 / (1 + searchRadius);
};

/** ミニブロットスコアのブースト倍率 */
const MINIBROT_WEIGHT = 5;

/**
 * ピーク座標の周囲にあるN点の孤立度からミニブロットらしさを算出する
 *
 * searchRadius内にN点が存在し、かつその密度が低い（孤立した小クラスタ）ほど高スコア。
 * ミニブロット（集合の小さな島）の近くでは高い値、大きな連続境界の近くでは低い値を返す。
 */
export const calcMinibrotScore = (
  buffer: Uint32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  maxIteration: number,
  searchRadius: number = DEFAULT_SEARCH_RADIUS,
): number => {
  let nCount = 0;
  let totalCount = 0;

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      totalCount++;
      if (buffer[ny * width + nx] === maxIteration) {
        nCount++;
      }
    }
  }

  if (nCount === 0) return 0;

  return 1 - nCount / totalCount;
};

/**
 * ブロック内のiteration値の多様性（局所エントロピー）を算出する
 *
 * ユニークなiteration値の数 / 有効ピクセル数で正規化。
 * 多様な値が混在する複雑な領域ほど高い値を返す。
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
  const uniqueValues = new Set<number>();
  let validCount = 0;

  const endX = Math.min(bx + blockSize, width);
  const endY = Math.min(by + blockSize, height);

  for (let py = by; py < endY; py++) {
    for (let px = bx; px < endX; px++) {
      const iter = buffer[py * width + px];
      if (iter === 0 || iter === maxIteration) continue;

      uniqueValues.add(iter);
      validCount++;
    }
  }

  if (validCount === 0) return 0;

  return uniqueValues.size / validCount;
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
      const proximity = calcBoundaryProximity(buffer, peak.x, peak.y, width, height, maxIteration);
      const minibrot = calcMinibrotScore(buffer, peak.x, peak.y, width, height, maxIteration);
      const entropy = calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration);

      const score = proximity * (1 + minibrot * MINIBROT_WEIGHT) * entropy * gradient;
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
