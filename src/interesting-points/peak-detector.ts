import type { BlockDebugInfo, InterestingPoint } from "./find-interesting-points";

/**
 * 峰検出のパラメータ
 */
export interface PeakDetectorOptions {
  /** 平滑化の半径（px）。小さい順に並べる。各スケールで独立に峰を評価する */
  scales?: number[];
  /** 候補点のグリッド間隔（px） */
  stride?: number;
  /** 円周サンプルの方向数 */
  directions?: number;
  /** 採用する最低スコア（画像の iteration 値域に対する落差の比率） */
  minScore?: number;
  /** 近接した峰を抑制する距離（px）。省略時は短辺の5% */
  suppressionRadius?: number;
  /** 返す最大件数 */
  maxPoints?: number;
}

/** スコアマップ。stride 間隔のグリッド上のスコアと、スケール別の内訳 */
export interface PeakScoreMap {
  stride: number;
  cols: number;
  rows: number;
  /** 合成スコア: Σ scaleWeight(i) × √perScale[i]。複数スケールで一貫して峰になる点ほど高い */
  score: Float32Array;
  /** スケール別スコア。scales と同じ順 */
  perScale: Float32Array[];
  scales: number[];
}

const DEFAULT_SCALES = [3, 6, 12, 24, 48, 96];
const DEFAULT_STRIDE = 4;
const DEFAULT_DIRECTIONS = 16;
const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_MAX_POINTS = 10;
/** シーン内の最大スコアに対してこの比率未満の峰は捨てる */
const RELATIVE_MIN_RATIO = 0.3;
/** スケール別スコアを合成する重み。index が大きい（粗い）スケールほど重くする */
const scaleWeight = (index: number): number => 0.5 + 0.25 * index;
/** 円周サンプルの半径は平滑化半径の何倍か */
const RING_RADIUS_RATIO = 2.5;
/** 落差を小さい順に並べたとき何番目を採用するか（0 = 最小）。枝1本分の非降下を許容する */
const ROBUST_MIN_RANK = 1;

/**
 * iteration 値を画像内の値域（p1〜p99）で正規化する。
 * 未計算（0）は NaN、集合内部（maxIteration）は有効最大値より少し上の値にして峰の頂上として扱う
 */
export const normalizeIterations = (buffer: Uint32Array, maxIteration: number): Float64Array => {
  const valid: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    if (v !== 0 && v < maxIteration) valid.push(v);
  }
  valid.sort((a, b) => a - b);
  const lo = valid[Math.floor(valid.length * 0.01)] ?? 0;
  const hi = Math.max(lo + 1, valid[Math.floor(valid.length * 0.99)] ?? 1);
  const maxValid = valid.length > 0 ? (valid[valid.length - 1] - lo) / (hi - lo) : 0;
  const out = new Float64Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    out[i] = v === 0 ? NaN : v >= maxIteration ? maxValid + 0.05 : (v - lo) / (hi - lo);
  }
  return out;
};

/** 有効画素のみを平均するための summed-area table（値の累積と有効数の累積） */
interface SummedArea {
  sum: Float64Array;
  count: Float64Array;
  width: number;
  height: number;
}

const buildSummedArea = (values: Float64Array, width: number, height: number): SummedArea => {
  const w1 = width + 1;
  const sum = new Float64Array(w1 * (height + 1));
  const count = new Float64Array(w1 * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    let rowCount = 0;
    for (let x = 1; x <= width; x++) {
      const v = values[(y - 1) * width + (x - 1)];
      if (!Number.isNaN(v)) {
        rowSum += v;
        rowCount++;
      }
      sum[y * w1 + x] = sum[(y - 1) * w1 + x] + rowSum;
      count[y * w1 + x] = count[(y - 1) * w1 + x] + rowCount;
    }
  }
  return { sum, count, width, height };
};

/** (cx, cy) を中心とする一辺 2r+1 の正方形の平均。有効画素がなければ NaN */
const boxMean = (sat: SummedArea, cx: number, cy: number, r: number): number => {
  const x0 = Math.max(0, cx - r);
  const y0 = Math.max(0, cy - r);
  const x1 = Math.min(sat.width, cx + r + 1);
  const y1 = Math.min(sat.height, cy + r + 1);
  if (x0 >= x1 || y0 >= y1) return NaN;
  const w1 = sat.width + 1;
  const idx = (x: number, y: number) => y * w1 + x;
  const c =
    sat.count[idx(x1, y1)] -
    sat.count[idx(x0, y1)] -
    sat.count[idx(x1, y0)] +
    sat.count[idx(x0, y0)];
  if (c === 0) return NaN;
  const s =
    sat.sum[idx(x1, y1)] - sat.sum[idx(x0, y1)] - sat.sum[idx(x1, y0)] + sat.sum[idx(x0, y0)];
  return s / c;
};

/**
 * 各グリッド点の「峰らしさ」をスケール別に算出する。
 *
 * 中心の平滑値から円周上の平滑値を引いた落差を全方向で求め、
 * 小さい方から ROBUST_MIN_RANK 番目を採用する。全方向で落ちている点（渦巻きやミニブロの中心）
 * だけが正のスコアを持ち、尾根（フィラメント）や平坦部は 0 になる
 */
export const computePeakScoreMap = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: PeakDetectorOptions,
): PeakScoreMap => {
  const scales = options?.scales ?? DEFAULT_SCALES;
  const stride = options?.stride ?? DEFAULT_STRIDE;
  const directions = options?.directions ?? DEFAULT_DIRECTIONS;

  const sat = buildSummedArea(normalizeIterations(buffer, maxIteration), width, height);
  const cols = Math.floor(width / stride);
  const rows = Math.floor(height / stride);
  const score = new Float32Array(cols * rows);
  const perScale = scales.map(() => new Float32Array(cols * rows));
  const cos = Array.from({ length: directions }, (_, d) =>
    Math.cos((2 * Math.PI * d) / directions),
  );
  const sin = Array.from({ length: directions }, (_, d) =>
    Math.sin((2 * Math.PI * d) / directions),
  );
  const drops = new Float64Array(directions);

  scales.forEach((sigma, si) => {
    const ring = sigma * RING_RADIUS_RATIO;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const cx = gx * stride;
        const cy = gy * stride;
        const center = boxMean(sat, cx, cy, sigma);
        if (Number.isNaN(center)) continue;
        for (let d = 0; d < directions; d++) {
          const px = Math.round(cx + ring * cos[d]);
          const py = Math.round(cy + ring * sin[d]);
          // 画像外や未計算の方向は「落ちていない」扱い。端で尾根が峰に化けるのを防ぐ
          const v =
            px < 0 || py < 0 || px >= width || py >= height ? NaN : boxMean(sat, px, py, sigma);
          drops[d] = Number.isNaN(v) ? 0 : center - v;
        }
        const sorted = drops.sort();
        const s = Math.max(0, sorted[ROBUST_MIN_RANK]);
        perScale[si][gy * cols + gx] = s;
        score[gy * cols + gx] += scaleWeight(si) * Math.sqrt(s);
      }
    }
  });

  return { stride, cols, rows, score, perScale, scales };
};

/**
 * スコアマップから峰を選出する。
 * 8近傍での局所最大 → minScore と最大値×RELATIVE_MIN_RATIO で足切り → スコア順に NMS（近接抑制）→ maxPoints 件
 */
export const selectPeaks = (
  map: PeakScoreMap,
  buffer: Uint32Array,
  width: number,
  height: number,
  options?: PeakDetectorOptions,
): InterestingPoint[] => {
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const maxPoints = options?.maxPoints ?? DEFAULT_MAX_POINTS;
  const suppression = options?.suppressionRadius ?? Math.min(width, height) * 0.05;
  const { stride, cols, rows, score } = map;
  let maxScore = 0;
  for (const s of score) if (s > maxScore) maxScore = s;
  const threshold = Math.max(minScore, maxScore * RELATIVE_MIN_RATIO);

  // 各候補の支配的スケール（合成スコアへの寄与が最大のスケール）。NMS の抑制半径に使う
  const dominantScale = (idx: number): number => {
    let best = 0;
    let bestValue = -1;
    map.perScale.forEach((p, i) => {
      const v = scaleWeight(i) * Math.sqrt(p[idx]);
      if (v > bestValue) {
        bestValue = v;
        best = map.scales[i];
      }
    });
    return best;
  };

  const candidates: Array<InterestingPoint & { scale: number }> = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const s = score[gy * cols + gx];
      if (s < threshold) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (score[ny * cols + nx] > s) {
            isMax = false;
            break;
          }
        }
      }
      if (!isMax) continue;
      const x = gx * stride;
      const y = gy * stride;
      candidates.push({
        x,
        y,
        iteration: buffer[y * width + x],
        score: s,
        scale: dominantScale(gy * cols + gx),
      });
    }
  }

  // NMS: 抑制半径は固定値と「両者の支配的スケールの円周半径」の大きい方。
  // 粗いスケールで検出された峰の肩に現れる副次的な極大を落とす
  candidates.sort((a, b) => b.score - a.score);
  const selected: Array<InterestingPoint & { scale: number }> = [];
  for (const c of candidates) {
    if (selected.length >= maxPoints) break;
    const suppressed = selected.some((s) => {
      const radius = Math.max(suppression, RING_RADIUS_RATIO * Math.max(s.scale, c.scale));
      return (s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= radius * radius;
    });
    if (!suppressed) selected.push(c);
  }
  return selected.map(({ scale: _, ...point }) => point);
};

/**
 * 峰検出で興味深いポイントを求める（computePeakScoreMap + selectPeaks）
 */
export const findPeaks = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: PeakDetectorOptions,
): { points: InterestingPoint[]; map: PeakScoreMap } => {
  const map = computePeakScoreMap(buffer, width, height, maxIteration, options);
  return { points: selectPeaks(map, buffer, width, height, options), map };
};

/** デバッグ用ブロックの上限。これを超える場合はグリッドを間引く */
const MAX_DEBUG_BLOCKS = 40000;

/**
 * スコアマップをデバッグUI（ヒートマップ）用の BlockDebugInfo 配列に変換する。
 * factors にはスケール別スコアを `s{σ}` の名前で入れる
 */
export const peakMapToDebugBlocks = (map: PeakScoreMap): BlockDebugInfo[] => {
  const { stride, cols, rows } = map;
  const step = Math.max(1, Math.ceil(Math.sqrt((cols * rows) / MAX_DEBUG_BLOCKS)));
  const blocks: BlockDebugInfo[] = [];
  for (let gy = 0; gy < rows; gy += step) {
    for (let gx = 0; gx < cols; gx += step) {
      const idx = gy * cols + gx;
      const factors: Record<string, number> = {};
      map.scales.forEach((sigma, i) => {
        factors[`s${sigma}`] = map.perScale[i][idx];
      });
      blocks.push({
        bx: gx * stride,
        by: gy * stride,
        blockSize: stride * step,
        factors,
        score: map.score[idx],
      });
    }
  }
  return blocks;
};
