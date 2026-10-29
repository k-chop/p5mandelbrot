import type { BlockDebugInfo, InterestingPoint } from "./find-interesting-points";

/**
 * 検出のパラメータ
 */
export interface PeakDetectorOptions {
  /** ピーク検出の平滑化半径（px）。小さい順に並べる。各スケールが1つの feature になる */
  scales?: number[];
  /** 候補点のグリッド間隔（px） */
  stride?: number;
  /** 円周サンプルの方向数 */
  directions?: number;
  /** 採用する最低合成スコア */
  minScore?: number;
  /** 近接した候補を抑制する距離（px）。省略時は短辺の5% */
  suppressionRadius?: number;
  /** 返す最大件数 */
  maxPoints?: number;
}

/**
 * 合成スコアを構成する1指標。グリッド上の値（0以上）を持つ。
 * 合成スコア = Σ weight × √value。別種の指標（収束点らしさ等）を足すときはここに追加する
 */
export interface ScoreFeature {
  /** ヒートマップ等で表示する名前 */
  name: string;
  /** この指標が見ている構造の大きさ（px）。NMS の抑制半径に使う */
  scale: number;
  /** 合成スコアへの重み */
  weight: number;
  values: Float32Array;
  /**
   * true なら候補（局所最大）の探索には使わず、この feature 自身の極大点に最も近い候補 1 つにだけ
   * weight × √value を加算する。広い領域で緩やかに高くなる指標（対称中心など）が、
   * それ自体で候補を作ったり周囲の候補をまとめて底上げしたりしないようにする
   */
  rankOnly?: boolean;
}

/** stride 間隔のグリッド上の合成スコアと、その内訳 */
export interface ScoreMap {
  stride: number;
  cols: number;
  rows: number;
  /** 合成スコア: Σ feature.weight × √feature.values（rankOnly の feature は含まない） */
  score: Float32Array;
  features: ScoreFeature[];
}

const DEFAULT_SCALES = [3, 6, 12, 24, 48, 96];
const DEFAULT_STRIDE = 4;
const DEFAULT_DIRECTIONS = 16;
const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_MAX_POINTS = 10;
/** シーン内の最大スコアに対してこの比率未満の候補は捨てる */
const RELATIVE_MIN_RATIO = 0.3;
/** ピーク feature の重み。index が大きい（粗い）スケールほど重くする */
const peakWeight = (index: number): number => 0.5 + 0.25 * index;
/** 局所コントラスト（z スコア）がこの値で 1.0 に飽和する */
const CONTRAST_Z_CAP = 4;
/** 局所コントラスト feature の重み（ピーク feature の重みに掛ける） */
const CONTRAST_WEIGHT = 1;
/** 対称中心 feature: 円周の半径（短辺に対する比率） */
const SYMMETRY_RADII = [0.1, 0.2, 0.3, 0.4];
/** 対称中心 feature: 円周のサンプル数 */
const SYMMETRY_SAMPLES = 90;
/** 対称中心 feature: 判定する回転次数。2 は直線が通るだけで成立してしまうので除く */
const SYMMETRY_ORDERS = [3, 4, 5, 6, 7, 8, 9];
/** 対称中心 feature: 計算するグリッド間隔（px）。スコアマップの stride より粗くてよい */
const SYMMETRY_STRIDE = 16;
/** 対称中心 feature: 円周の値の標準偏差がこの値で重み 1.0 になる（小さなうねりの偶然の周期性を抑える） */
const SYMMETRY_FULL_SD = 0.05;
/** rankOnly feature の極大とみなす最低値 */
const RANK_ONLY_MIN_VALUE = 0.3;
/** rankOnly feature の極大を探す近傍半径（短辺に対する比率） */
const RANK_ONLY_PEAK_RADIUS = 0.1;
/** rankOnly feature の極大点からこの距離（px）以内の最寄り候補にボーナスを付ける */
const RANK_ONLY_ATTACH_RADIUS = 32;
/** 対称中心 feature の重み */
const SYMMETRY_WEIGHT = 2;
/** 円周サンプルの半径は平滑化半径の何倍か */
const RING_RADIUS_RATIO = 2.5;
/** 落差を小さい順に並べたとき何番目を採用するか（0 = 最小）。枝1本分の非降下を許容する */
const ROBUST_MIN_RANK = 1;

/**
 * iteration 値を画像内の値域（p1〜p99）で正規化する。
 * 未計算（0）は NaN、集合内部（maxIteration）は有効最大値より少し上の値にしてピークの頂上として扱う
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
  sumSq: Float64Array;
  count: Float64Array;
  width: number;
  height: number;
}

const buildSummedArea = (values: Float64Array, width: number, height: number): SummedArea => {
  const w1 = width + 1;
  const sum = new Float64Array(w1 * (height + 1));
  const sumSq = new Float64Array(w1 * (height + 1));
  const count = new Float64Array(w1 * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    let rowCount = 0;
    for (let x = 1; x <= width; x++) {
      const v = values[(y - 1) * width + (x - 1)];
      if (!Number.isNaN(v)) {
        rowSum += v;
        rowSumSq += v * v;
        rowCount++;
      }
      sum[y * w1 + x] = sum[(y - 1) * w1 + x] + rowSum;
      sumSq[y * w1 + x] = sumSq[(y - 1) * w1 + x] + rowSumSq;
      count[y * w1 + x] = count[(y - 1) * w1 + x] + rowCount;
    }
  }
  return { sum, sumSq, count, width, height };
};

/** summed-area table から矩形の合計を引く */
const boxSum = (
  table: Float64Array,
  w1: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number => table[y1 * w1 + x1] - table[y0 * w1 + x1] - table[y1 * w1 + x0] + table[y0 * w1 + x0];

/** (cx, cy) を中心とする一辺 2r+1 の正方形の平均と標準偏差。有効画素がなければ NaN */
const boxStats = (
  sat: SummedArea,
  cx: number,
  cy: number,
  r: number,
): { mean: number; sd: number } => {
  const x0 = Math.max(0, cx - r);
  const y0 = Math.max(0, cy - r);
  const x1 = Math.min(sat.width, cx + r + 1);
  const y1 = Math.min(sat.height, cy + r + 1);
  if (x0 >= x1 || y0 >= y1) return { mean: NaN, sd: NaN };
  const w1 = sat.width + 1;
  const c = boxSum(sat.count, w1, x0, y0, x1, y1);
  if (c === 0) return { mean: NaN, sd: NaN };
  const mean = boxSum(sat.sum, w1, x0, y0, x1, y1) / c;
  const variance = boxSum(sat.sumSq, w1, x0, y0, x1, y1) / c - mean * mean;
  return { mean, sd: Math.sqrt(Math.max(0, variance)) };
};

/** (cx, cy) を中心とする一辺 2r+1 の正方形の平均。有効画素がなければ NaN */
const boxMean = (sat: SummedArea, cx: number, cy: number, r: number): number =>
  boxStats(sat, cx, cy, r).mean;

/** グリッドの寸法。feature 計算関数に共通で渡す */
interface Grid {
  stride: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
}

/**
 * 各グリッド点の「ピークらしさ」を1スケール分算出する。
 *
 * 中心の平滑値から円周上の平滑値を引いた落差を全方向で求め、
 * 小さい方から ROBUST_MIN_RANK 番目を採用する。全方向で落ちている点（渦巻きやミニブロの中心）
 * だけが正の値を持ち、尾根（フィラメント）や平坦部は 0 になる
 */
const computePeakFeature = (
  sat: SummedArea,
  grid: Grid,
  sigma: number,
  directions: number,
): { drop: Float32Array; contrast: Float32Array } => {
  const { stride, cols, rows, width, height } = grid;
  const values = new Float32Array(cols * rows);
  const contrast = new Float32Array(cols * rows);
  const ring = sigma * RING_RADIUS_RATIO;
  const cos = Array.from({ length: directions }, (_, d) =>
    Math.cos((2 * Math.PI * d) / directions),
  );
  const sin = Array.from({ length: directions }, (_, d) =>
    Math.sin((2 * Math.PI * d) / directions),
  );
  const drops = new Float64Array(directions);

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const cx = gx * stride;
      const cy = gy * stride;
      const center = boxMean(sat, cx, cy, sigma);
      if (Number.isNaN(center)) continue;
      for (let d = 0; d < directions; d++) {
        const px = Math.round(cx + ring * cos[d]);
        const py = Math.round(cy + ring * sin[d]);
        // 画像外や未計算の方向は「落ちていない」扱い。端で尾根がピークに化けるのを防ぐ
        const v =
          px < 0 || py < 0 || px >= width || py >= height ? NaN : boxMean(sat, px, py, sigma);
        drops[d] = Number.isNaN(v) ? 0 : center - v;
      }
      const drop = Math.max(0, drops.sort()[ROBUST_MIN_RANK]);
      values[gy * cols + gx] = drop;
      // 局所コントラスト: 円周半径の箱の中の散らばりに対する落差（z スコア風）。
      // 画面全体の値域に対して小さくても、周囲に比べて明確なピークなら高くなる
      const { sd } = boxStats(sat, cx, cy, Math.round(ring));
      const z = sd > 0 ? drop / sd : 0;
      contrast[gy * cols + gx] = Math.min(1, z / CONTRAST_Z_CAP);
    }
  }
  return { drop: values, contrast };
};

/** 円周プロファイルを angle（サンプル単位、小数可）だけ回したときの相関（平均除去済み、正規化） */
const ringCorrelation = (profile: Float64Array, shift: number): number => {
  const m = profile.length;
  let dot = 0;
  for (let k = 0; k < m; k++) {
    const pos = (k + shift) % m;
    const i0 = Math.floor(pos);
    const f = pos - i0;
    const v = profile[i0] * (1 - f) + profile[(i0 + 1) % m] * f;
    dot += profile[k] * v;
  }
  return dot;
};

/**
 * 各グリッド点の「盤面の対称中心らしさ」を算出する。
 *
 * 点を中心とする大きな円周上で平滑化した値の並びを取り、1/n 回転ずらしたときの相関から
 * 1/(2n) 回転ずらしたときの相関を引く（滑らかなだけの分布はどちらも高く、n 回対称なら前者だけ高い）。
 * 複数半径の最大を採用する。ピークの強さとは独立に「その点を中心に構造が繰り返している」ことを測る
 */
const computeSymmetryFeature = (sat: SummedArea, grid: Grid): Float32Array => {
  const { stride, cols, rows, width, height } = grid;
  const values = new Float32Array(cols * rows);
  const minDim = Math.min(width, height);
  const step = Math.max(1, Math.round(SYMMETRY_STRIDE / stride));
  const profile = new Float64Array(SYMMETRY_SAMPLES);
  const cos = Array.from({ length: SYMMETRY_SAMPLES }, (_, k) =>
    Math.cos((2 * Math.PI * k) / SYMMETRY_SAMPLES),
  );
  const sin = Array.from({ length: SYMMETRY_SAMPLES }, (_, k) =>
    Math.sin((2 * Math.PI * k) / SYMMETRY_SAMPLES),
  );

  for (let gy = 0; gy < rows; gy += step) {
    for (let gx = 0; gx < cols; gx += step) {
      const cx = gx * stride;
      const cy = gy * stride;
      const perRadius: number[] = [];
      for (const ratio of SYMMETRY_RADII) {
        const radius = ratio * minDim;
        const sigma = Math.max(2, Math.round(radius / 16));
        let sum = 0;
        let valid = 0;
        for (let k = 0; k < SYMMETRY_SAMPLES; k++) {
          const px = Math.round(cx + radius * cos[k]);
          const py = Math.round(cy + radius * sin[k]);
          const v =
            px < 0 || py < 0 || px >= width || py >= height ? NaN : boxMean(sat, px, py, sigma);
          profile[k] = v;
          if (!Number.isNaN(v)) {
            sum += v;
            valid++;
          }
        }
        // 円周の1割以上が画像外・未計算なら、この半径は評価しない
        if (valid < SYMMETRY_SAMPLES * 0.9) continue;
        const mean = sum / valid;
        let sumSq = 0;
        for (let k = 0; k < SYMMETRY_SAMPLES; k++) {
          profile[k] = Number.isNaN(profile[k]) ? 0 : profile[k] - mean;
          sumSq += profile[k] * profile[k];
        }
        if (sumSq === 0) continue;
        const amplitude = Math.min(1, Math.sqrt(sumSq / SYMMETRY_SAMPLES) / SYMMETRY_FULL_SD);
        let best = 0;
        for (const n of SYMMETRY_ORDERS) {
          // k/n 回転（k=1..n-1）すべてで相関が高く、その中間の回転では低いことを要求する。
          // 1/n 回転だけ見ると、塊が2つあるだけの円周でも角度差に合う n に当たってしまう
          let full = 0;
          let half = 0;
          for (let k = 1; k < n; k++) {
            full += ringCorrelation(profile, (SYMMETRY_SAMPLES * k) / n);
            half += ringCorrelation(profile, (SYMMETRY_SAMPLES * (k - 0.5)) / n);
          }
          // 完全な n 回対称で (full - half) / (n - 1) = 2 になるので 2 で割って 0〜1 にする
          best = Math.max(best, amplitude * Math.min(1, (full - half) / (2 * (n - 1) * sumSq)));
        }
        perRadius.push(best);
      }
      // 本物の対称中心はどの半径でも周期的なので、上位2半径の平均を採る（1半径だけの偶然を抑える）
      perRadius.sort((a, b) => b - a);
      const best = perRadius.length >= 2 ? (perRadius[0] + perRadius[1]) / 2 : 0;
      // 粗いグリッドの値を stride グリッドに敷き詰める
      for (let dy = 0; dy < step && gy + dy < rows; dy++) {
        for (let dx = 0; dx < step && gx + dx < cols; dx++) {
          values[(gy + dy) * cols + gx + dx] = best;
        }
      }
    }
  }
  return values;
};

/**
 * 全 feature を計算して合成スコアマップを作る。
 * feature はスケール別の「落差」（`peak{σ}`）と「局所コントラスト」（`contrast{σ}`）、
 * それに順位付け専用の「対称中心らしさ」（`symmetry`）。
 * 落差は画面全体で大きな構造を、コントラストは画面の値域に対して小さくても周囲より明確に浮き出た構造を拾い、
 * 対称中心は「盤面がその点を中心に回転対称」という、ピークの強さとは別の手がかりで順位を上げる
 */
export const computeScoreMap = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: PeakDetectorOptions,
): ScoreMap => {
  const scales = options?.scales ?? DEFAULT_SCALES;
  const stride = options?.stride ?? DEFAULT_STRIDE;
  const directions = options?.directions ?? DEFAULT_DIRECTIONS;

  const sat = buildSummedArea(normalizeIterations(buffer, maxIteration), width, height);
  const grid: Grid = {
    stride,
    cols: Math.floor(width / stride),
    rows: Math.floor(height / stride),
    width,
    height,
  };

  const features: ScoreFeature[] = scales.flatMap((sigma, i) => {
    const { drop, contrast } = computePeakFeature(sat, grid, sigma, directions);
    return [
      { name: `peak${sigma}`, scale: sigma, weight: peakWeight(i), values: drop },
      {
        name: `contrast${sigma}`,
        scale: sigma,
        weight: CONTRAST_WEIGHT * peakWeight(i),
        values: contrast,
      },
    ];
  });

  features.push({
    name: "symmetry",
    // NMS の抑制半径を広げないよう、スケールは最小にしておく
    scale: scales[0],
    weight: SYMMETRY_WEIGHT,
    values: computeSymmetryFeature(sat, grid),
    rankOnly: true,
  });

  const score = new Float32Array(grid.cols * grid.rows);
  for (const f of features) {
    if (f.rankOnly) continue;
    for (let i = 0; i < score.length; i++) score[i] += f.weight * Math.sqrt(f.values[i]);
  }
  return { stride, cols: grid.cols, rows: grid.rows, score, features };
};

/**
 * rankOnly feature の極大点を探し、それぞれ最寄りの候補 1 つに weight × √value を加算する
 */
const applyRankOnlyBonus = (
  map: ScoreMap,
  candidates: Array<InterestingPoint & { scale: number }>,
  minDim: number,
): void => {
  const { stride, cols, rows } = map;
  const radiusCells = Math.max(1, Math.round((RANK_ONLY_PEAK_RADIUS * minDim) / stride));
  for (const f of map.features) {
    if (!f.rankOnly) continue;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const v = f.values[gy * cols + gx];
        if (v < RANK_ONLY_MIN_VALUE) continue;
        let isMax = true;
        for (let dy = -radiusCells; dy <= radiusCells && isMax; dy++) {
          for (let dx = -radiusCells; dx <= radiusCells; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const nv = f.values[ny * cols + nx];
            // 同値のプラトーは左上の点だけを極大とみなす
            if (nv > v || (nv === v && (dy < 0 || (dy === 0 && dx < 0)))) {
              isMax = false;
              break;
            }
          }
        }
        if (!isMax) continue;
        const x = gx * stride;
        const y = gy * stride;
        let nearest: (InterestingPoint & { scale: number }) | null = null;
        let nearestDist = RANK_ONLY_ATTACH_RADIUS * RANK_ONLY_ATTACH_RADIUS;
        for (const c of candidates) {
          const d = (c.x - x) ** 2 + (c.y - y) ** 2;
          if (d <= nearestDist) {
            nearestDist = d;
            nearest = c;
          }
        }
        if (nearest) nearest.score += f.weight * Math.sqrt(v);
      }
    }
  }
};

/**
 * スコアマップから興味深いポイントを選出する。
 * 8近傍での局所最大 → minScore と最大値×RELATIVE_MIN_RATIO で足切り → スコア順に NMS（近接抑制）→ maxPoints 件
 */
export const selectPeaks = (
  map: ScoreMap,
  buffer: Uint32Array,
  width: number,
  height: number,
  options?: PeakDetectorOptions,
): InterestingPoint[] => {
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const maxPoints = options?.maxPoints ?? DEFAULT_MAX_POINTS;
  const suppression = options?.suppressionRadius ?? Math.min(width, height) * 0.05;
  const { stride, cols, rows, score } = map;

  // 各候補の支配的スケール（合成スコアへの寄与が最大の feature のスケール）。NMS の抑制半径に使う
  const dominantScale = (idx: number): number => {
    let best = 0;
    let bestValue = -1;
    for (const f of map.features) {
      const v = f.weight * Math.sqrt(f.values[idx]);
      if (v > bestValue) {
        bestValue = v;
        best = f.scale;
      }
    }
    return best;
  };

  const candidates: Array<InterestingPoint & { scale: number }> = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const s = score[gy * cols + gx];
      if (s <= 0) continue;
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

  // 相対閾値はボーナス前の最大値で決める（ボーナスは順位付けのためのもので、足切りを厳しくしない）
  let maxScore = 0;
  for (const c of candidates) if (c.score > maxScore) maxScore = c.score;
  const threshold = Math.max(minScore, maxScore * RELATIVE_MIN_RATIO);

  applyRankOnlyBonus(map, candidates, Math.min(width, height));

  // NMS: 抑制半径は固定値と「候補自身の支配的スケールの円周半径」の大きい方。
  // 粗いスケールで検出されたピークの肩に現れる副次的な極大（それ自身も粗いスケール）を落としつつ、
  // 広い丘の上にある小さく鋭いピークは別物として残す
  candidates.sort((a, b) => b.score - a.score);
  const selected: Array<InterestingPoint & { scale: number }> = [];
  for (const c of candidates) {
    if (selected.length >= maxPoints || c.score < threshold) break;
    const suppressed = selected.some((s) => {
      const radius = Math.max(suppression, RING_RADIUS_RATIO * c.scale);
      return (s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= radius * radius;
    });
    if (!suppressed) selected.push(c);
  }
  return selected.map(({ scale: _, ...point }) => point);
};

/**
 * 興味深いポイントを求める（computeScoreMap + selectPeaks）
 */
export const findPeaks = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  options?: PeakDetectorOptions,
): { points: InterestingPoint[]; map: ScoreMap } => {
  const map = computeScoreMap(buffer, width, height, maxIteration, options);
  return { points: selectPeaks(map, buffer, width, height, options), map };
};

/** デバッグ用ブロックの上限。これを超える場合はグリッドを間引く */
const MAX_DEBUG_BLOCKS = 40000;

/**
 * スコアマップをデバッグUI（ヒートマップ）用の BlockDebugInfo 配列に変換する。
 * factors には各 feature の値を feature 名で入れる
 */
export const peakMapToDebugBlocks = (map: ScoreMap): BlockDebugInfo[] => {
  const { stride, cols, rows } = map;
  const step = Math.max(1, Math.ceil(Math.sqrt((cols * rows) / MAX_DEBUG_BLOCKS)));
  const blocks: BlockDebugInfo[] = [];
  for (let gy = 0; gy < rows; gy += step) {
    for (let gx = 0; gx < cols; gx += step) {
      const idx = gy * cols + gx;
      const factors: Record<string, number> = {};
      for (const f of map.features) factors[f.name] = f.values[idx];
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
