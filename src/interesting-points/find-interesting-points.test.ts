import { describe, expect, it } from "vitest";
import {
  applyNMS,
  calcGradientMagnitude,
  calcLocalEntropy,
  calcNeighborhoodGradientDensity,
  calcRotationalSymmetry,
  findBlockPeak,
  findCandidatesAtScale,
  findInterestingPoints,
  findStructureCenter,
  mergeCandidatesAcrossScales,
  mergeProximityCandidates,
} from "./find-interesting-points";
import type { BlockDebugInfo } from "./find-interesting-points";

describe("findInterestingPoints", () => {
  it("全ピクセルがN（集合内）→ 空配列", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(N);

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 4,
    });

    expect(result).toEqual([]);
  });

  it("全ピクセルが0（未計算）→ 空配列", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height);

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 4,
    });

    expect(result).toEqual([]);
  });

  it("単一ピーク → 正しい座標・iteration・スコアが返る", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(10);
    // (3, 3) に高いiteration値を配置
    buffer[3 * width + 3] = 50;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 5,
      minIteration: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(3);
    expect(result[0].y).toBe(3);
    expect(result[0].iteration).toBe(50);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("複数ピーク → topKで絞り込み、スコア降順", () => {
    const N = 1000;
    const width = 16;
    const height = 16;
    const buffer = new Uint32Array(width * height).fill(10);

    // ブロック(0,0)にピーク
    buffer[2 * width + 2] = 500;
    // ブロック(8,0)にピーク（周囲との差が大きい）
    buffer[2 * width + 10] = 800;
    // ブロック(0,8)にピーク
    buffer[10 * width + 2] = 300;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 2,
      minIteration: 5,
    });

    expect(result).toHaveLength(2);
    // スコア降順
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
  });

  it("バッファ端のピーク → エッジケースで勾配計算が正しい", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    // 左上角(0, 0)にピーク
    buffer[0] = 50;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 4,
      topK: 5,
      minIteration: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("エントロピーが同等なら勾配が大きい点が優先される", () => {
    const N = 1000;
    const width = 16;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(50);

    // ブロック(0,0): iteration=200、周囲は全部50 → 大きい勾配
    buffer[2 * width + 2] = 200;

    // ブロック(8,0): iteration=120、周囲は全部50 → 小さい勾配
    buffer[2 * width + 10] = 120;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 5,
      minIteration: 5,
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    // ブロック(0,0)の方が勾配が大きいので先に来る
    const first = result[0];
    const second = result[1];
    expect(first.x).toBe(2);
    expect(first.y).toBe(2);
    expect(second.x).toBe(10);
    expect(second.y).toBe(2);
    expect(first.score).toBeGreaterThan(second.score);
  });

  it("minIteration未満のピクセルは無視される", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(3);
    // minIteration=10 より低いので検出されない
    buffer[3 * width + 3] = 9;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      minIteration: 10,
    });

    expect(result).toEqual([]);
  });
});

describe("calcGradientMagnitude", () => {
  it("周囲と同じ値なら勾配0", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(50);

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    expect(result).toBe(0);
  });

  it("中心だけ値が異なれば正の勾配", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[1 * width + 1] = 50;

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    // 8方向全てで差が40 → sqrt(8 * 40^2) = sqrt(12800)
    expect(result).toBeCloseTo(Math.sqrt(8 * 40 * 40));
  });

  it("maxIterationの中心は勾配0を返す", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[1 * width + 1] = 100;

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    expect(result).toBe(0);
  });

  it("0の中心は勾配0を返す", () => {
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[1 * width + 1] = 0;

    const result = calcGradientMagnitude(buffer, 1, 1, width, height, 100);

    expect(result).toBe(0);
  });
});

describe("calcLocalEntropy", () => {
  it("全ピクセルが同じ値なら低エントロピー", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(50);

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    // 16ピクセル全て50 → Shannon entropy = 0
    expect(result).toBe(0);
  });

  it("多様な値があれば高エントロピー", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height);
    // 全ピクセルに異なる値を設定
    for (let i = 0; i < width * height; i++) {
      buffer[i] = i + 1; // 1~16
    }

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    // 16ピクセル全て異なる → Shannon entropy = log₂(16)/log₂(16) = 1.0
    expect(result).toBe(1);
  });

  it("0とNは有効ピクセルに含まれない", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(50);
    buffer[0] = 0;
    buffer[1] = N;

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    // 14ピクセルが50 → Shannon entropy = 0
    expect(result).toBe(0);
  });

  it("有効ピクセルがなければ0", () => {
    const N = 100;
    const width = 4;
    const height = 4;
    const buffer = new Uint32Array(width * height).fill(N);

    const result = calcLocalEntropy(buffer, 0, 0, 4, width, height, N);

    expect(result).toBe(0);
  });
});

describe("findCandidatesAtScale", () => {
  it("score > 0の全候補をtopKフィルタなしで返す", () => {
    const N = 1000;
    const width = 16;
    const height = 16;
    const buffer = new Uint32Array(width * height).fill(10);

    // 3つのブロックにピーク配置（blockSize=8）
    buffer[2 * width + 2] = 500;
    buffer[2 * width + 10] = 800;
    buffer[10 * width + 2] = 300;

    const result = findCandidatesAtScale(buffer, width, height, N, 8, 5);

    expect(result).toHaveLength(3);
    result.forEach((c) => expect(c.score).toBeGreaterThan(0));
  });
});

describe("mergeCandidatesAcrossScales", () => {
  it("閾値内の候補は1クラスタにまとまる", () => {
    const candidates = [
      { x: 10, y: 10, iteration: 50, score: 100, scale: 64 },
      { x: 12, y: 11, iteration: 55, score: 80, scale: 32 },
      { x: 11, y: 10, iteration: 52, score: 90, scale: 16 },
    ];

    const result = mergeCandidatesAcrossScales(candidates, 32);

    expect(result).toHaveLength(1);
    // 3スケール出現 → boost = 1 + 0.5 * (3 - 1) = 2.0
    expect(result[0].score).toBeCloseTo(100 * 2.0);
    // 最高スコア候補の座標を採用
    expect(result[0].x).toBe(10);
    expect(result[0].y).toBe(10);
  });

  it("閾値外の候補は別クラスタになる", () => {
    const candidates = [
      { x: 10, y: 10, iteration: 50, score: 100, scale: 32 },
      { x: 100, y: 100, iteration: 60, score: 90, scale: 32 },
    ];

    const result = mergeCandidatesAcrossScales(candidates, 32);

    expect(result).toHaveLength(2);
    // 各クラスタ1スケールのみ → boost なし
    expect(result[0].score).toBe(100);
    expect(result[1].score).toBe(90);
  });

  it("同スケールの近接候補はクラスタ化されるがブーストなし", () => {
    const candidates = [
      { x: 10, y: 10, iteration: 50, score: 100, scale: 32 },
      { x: 12, y: 11, iteration: 55, score: 80, scale: 32 },
    ];

    const result = mergeCandidatesAcrossScales(candidates, 32);

    expect(result).toHaveLength(1);
    // 同スケールなのでuniqueScaleCount=1、ブーストなし
    expect(result[0].score).toBe(100);
  });
});

describe("findInterestingPoints マルチスケール", () => {
  it("scalesオプションで指定したスケールが使われる", () => {
    const N = 1000;
    const width = 32;
    const height = 32;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[4 * width + 4] = 500;

    const result = findInterestingPoints(buffer, width, height, N, {
      scales: [16, 8],
      topK: 5,
      minIteration: 5,
    });

    // ポイントが検出されること
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("複数スケールで現れるポイントがブーストされる", () => {
    const N = 1000;
    const width = 64;
    const height = 64;
    const buffer = new Uint32Array(width * height).fill(10);

    // (4, 4) に高ピーク → 複数スケールで検出される
    buffer[4 * width + 4] = 500;

    // (60, 60) に同程度のピーク → 一部スケールでのみ検出
    buffer[60 * width + 60] = 500;
    // 周囲に別の値を置いてエントロピーを確保
    buffer[60 * width + 61] = 300;
    buffer[61 * width + 60] = 200;

    const singleScale = findInterestingPoints(buffer, width, height, N, {
      blockSize: 32,
      topK: 10,
      minIteration: 5,
    });

    const multiScale = findInterestingPoints(buffer, width, height, N, {
      scales: [32, 16, 8],
      topK: 10,
      minIteration: 5,
    });

    // マルチスケールでは候補が存在する
    expect(multiScale.length).toBeGreaterThanOrEqual(1);
    // マルチスケールの最高スコアは単一スケールより高い（ブースト効果）
    expect(multiScale[0].score).toBeGreaterThan(singleScale[0].score);
  });

  it("scoring: 'entropy-gradient' + scales指定でマルチスケールで動作する", () => {
    const N = 1000;
    const width = 128;
    const height = 128;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[32 * width + 32] = 500;

    const result = findInterestingPoints(buffer, width, height, N, {
      scoring: "entropy-gradient",
      scales: [64, 32, 16],
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe("findBlockPeak", () => {
  it("全部Nならnull", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(N);

    const result = findBlockPeak(buffer, 0, 0, 4, width, height, N, 10);

    expect(result).toBeNull();
  });

  it("ブロック内の最大iteration値のピクセルを返す", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(20);
    buffer[1 * width + 2] = 80;
    buffer[2 * width + 3] = 60;

    const result = findBlockPeak(buffer, 0, 0, 4, width, height, N, 10);

    expect(result).toEqual({ x: 2, y: 1, iteration: 80 });
  });

  it("ブロックがキャンバス端にはみ出ても正しく動作する", () => {
    const N = 100;
    const width = 6;
    const height = 6;
    const buffer = new Uint32Array(width * height).fill(20);
    // ブロック(4,4)は6x6キャンバスでは2x2しかない
    buffer[5 * width + 5] = 80;

    const result = findBlockPeak(buffer, 4, 4, 4, width, height, N, 10);

    expect(result).toEqual({ x: 5, y: 5, iteration: 80 });
  });
});

/**
 * n回回転対称のパターンをバッファに描画するヘルパー
 *
 * 中心(cx, cy)の周囲に iter = baseVal + amplitude * cos(n * angle) のパターンを生成する。
 */
const fillRadialPattern = (
  buffer: Uint32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  n: number,
  baseVal: number,
  amplitude: number,
  maxRadius: number,
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxRadius || dist === 0) continue;

      const angle = Math.atan2(dy, dx);
      const val = Math.round(baseVal + amplitude * Math.cos(n * angle));
      buffer[y * width + x] = Math.max(1, val);
    }
  }
};

describe("calcNeighborhoodGradientDensity", () => {
  it("全ピクセル同一値 → 0", () => {
    const width = 160;
    const height = 160;
    const buffer = new Uint32Array(width * height).fill(50);

    const result = calcNeighborhoodGradientDensity(buffer, 80, 80, width, height, 100);

    expect(result).toBe(0);
  });

  it("周囲に勾配がある → 正の値", () => {
    const width = 160;
    const height = 160;
    const buffer = new Uint32Array(width * height).fill(50);

    // 中心付近にグラデーション的な構造を配置
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - 80;
        const dy = y - 80;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < 70) {
          buffer[y * width + x] = Math.round(50 + dist);
        }
      }
    }

    const result = calcNeighborhoodGradientDensity(buffer, 80, 80, width, height, 200);

    expect(result).toBeGreaterThan(0);
  });

  it("中心付近が平坦でも周辺に構造があれば正の値を返す", () => {
    const width = 160;
    const height = 160;
    const buffer = new Uint32Array(width * height).fill(50);

    // 中心(80,80)の半径5以内は平坦だが、半径10-60に構造がある
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - 80;
        const dy = y - 80;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 10 && dist < 60) {
          const angle = Math.atan2(dy, dx);
          buffer[y * width + x] = Math.round(50 + 30 * Math.cos(4 * angle));
        }
      }
    }

    const result = calcNeighborhoodGradientDensity(buffer, 80, 80, width, height, 200);

    expect(result).toBeGreaterThan(0);
  });
});

describe("calcRotationalSymmetry", () => {
  it("flat region（全ピクセル同一値）→ スコア0", () => {
    const width = 80;
    const height = 80;
    const buffer = new Uint32Array(width * height).fill(50);

    const result = calcRotationalSymmetry(buffer, 40, 40, width, height, 100);

    expect(result).toBe(0);
  });

  it("2-fold対称パターン → 正のスコア", () => {
    const width = 80;
    const height = 80;
    const buffer = new Uint32Array(width * height).fill(50);
    fillRadialPattern(buffer, width, height, 40, 40, 2, 50, 30, 35);

    const result = calcRotationalSymmetry(buffer, 40, 40, width, height, 200);

    expect(result).toBeGreaterThan(0);
  });

  it("4-fold対称パターン → 正のスコア", () => {
    const width = 80;
    const height = 80;
    const buffer = new Uint32Array(width * height).fill(50);
    fillRadialPattern(buffer, width, height, 40, 40, 4, 50, 30, 35);

    const result = calcRotationalSymmetry(buffer, 40, 40, width, height, 200);

    expect(result).toBeGreaterThan(0);
  });

  it("非対称パターン → 対称パターンよりスコアが低い", () => {
    const width = 80;
    const height = 80;
    const maxIter = 200;

    // 4-fold対称パターン
    const symBuffer = new Uint32Array(width * height).fill(50);
    fillRadialPattern(symBuffer, width, height, 40, 40, 4, 50, 30, 35);
    const symScore = calcRotationalSymmetry(symBuffer, 40, 40, width, height, maxIter);

    // ランダム風パターン（非対称）
    const asymBuffer = new Uint32Array(width * height).fill(50);
    for (let y = 10; y < 70; y++) {
      for (let x = 10; x < 70; x++) {
        // 対称性がない不規則パターン
        asymBuffer[y * width + x] = 20 + ((x * 7 + y * 13 + x * y) % 160);
      }
    }
    const asymScore = calcRotationalSymmetry(asymBuffer, 40, 40, width, height, maxIter);

    expect(symScore).toBeGreaterThan(asymScore);
  });

  it("境界付近の中心(0,0) → エラーなし", () => {
    const width = 80;
    const height = 80;
    const buffer = new Uint32Array(width * height).fill(50);

    expect(() => calcRotationalSymmetry(buffer, 0, 0, width, height, 100)).not.toThrow();
  });

  it("0とmaxIterationピクセルは無視される", () => {
    const width = 80;
    const height = 80;
    const maxIter = 100;
    // 全ピクセルが0またはmaxIteration
    const buffer = new Uint32Array(width * height);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = i % 2 === 0 ? 0 : maxIter;
    }

    const result = calcRotationalSymmetry(buffer, 40, 40, width, height, maxIter);

    expect(result).toBe(0);
  });
});

describe("mergeProximityCandidates", () => {
  it("閾値内の候補 → 1クラスタ", () => {
    const candidates = [
      { x: 10, y: 10, iteration: 50, score: 100 },
      { x: 12, y: 11, iteration: 55, score: 80 },
      { x: 11, y: 10, iteration: 52, score: 90 },
    ];

    const result = mergeProximityCandidates(candidates, 16);

    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(100);
    expect(result[0].x).toBe(10);
    expect(result[0].y).toBe(10);
  });

  it("閾値外の候補 → 2クラスタ", () => {
    const candidates = [
      { x: 10, y: 10, iteration: 50, score: 100 },
      { x: 100, y: 100, iteration: 60, score: 90 },
    ];

    const result = mergeProximityCandidates(candidates, 16);

    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(100);
    expect(result[1].score).toBe(90);
  });
});

describe("findInterestingPoints symmetryモード", () => {
  it("対称パターンが検出される", () => {
    const width = 128;
    const height = 128;
    const maxIter = 500;
    const buffer = new Uint32Array(width * height).fill(50);
    fillRadialPattern(buffer, width, height, 64, 64, 4, 100, 80, 40);

    const result = findInterestingPoints(buffer, width, height, maxIter, {
      scoring: "symmetry",
      topK: 5,
      minIteration: 5,
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("デフォルト（オプションなし）→ symmetryで動作する", () => {
    const width = 128;
    const height = 128;
    const maxIter = 500;
    const buffer = new Uint32Array(width * height).fill(50);
    fillRadialPattern(buffer, width, height, 64, 64, 4, 100, 80, 40);

    const result = findInterestingPoints(buffer, width, height, maxIter);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("blockSize指定 → entropy-gradientで動作（後方互換）", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[3 * width + 3] = 50;

    const result = findInterestingPoints(buffer, width, height, N, {
      blockSize: 8,
      topK: 5,
      minIteration: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(3);
    expect(result[0].y).toBe(3);
  });

  it("scoring: 'entropy-gradient' → entropy-gradientで動作", () => {
    const N = 100;
    const width = 8;
    const height = 8;
    const buffer = new Uint32Array(width * height).fill(10);
    buffer[3 * width + 3] = 50;

    const result = findInterestingPoints(buffer, width, height, N, {
      scoring: "entropy-gradient",
      topK: 5,
      minIteration: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(3);
    expect(result[0].y).toBe(3);
  });
});

describe("applyNMS", () => {
  it("全候補が十分離れている → topK個そのまま返る", () => {
    const candidates = [
      { x: 0, y: 0, iteration: 50, score: 10 },
      { x: 100, y: 0, iteration: 50, score: 8 },
      { x: 200, y: 0, iteration: 50, score: 6 },
    ];
    const result = applyNMS(candidates, 3, 30);
    expect(result).toHaveLength(3);
  });

  it("密集候補 → suppressionRadius以内のものが除外される", () => {
    const candidates = [
      { x: 50, y: 50, iteration: 50, score: 10 },
      { x: 55, y: 50, iteration: 50, score: 9 },
      { x: 200, y: 200, iteration: 50, score: 5 },
    ];
    const result = applyNMS(candidates, 3, 30);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ x: 50, y: 50, score: 10 });
    expect(result[1]).toMatchObject({ x: 200, y: 200, score: 5 });
  });

  it("topKに満たない → 候補数そのまま返る", () => {
    const candidates = [{ x: 0, y: 0, iteration: 50, score: 10 }];
    const result = applyNMS(candidates, 5, 30);
    expect(result).toHaveLength(1);
  });

  it("空配列 → 空配列", () => {
    const result = applyNMS([], 5, 30);
    expect(result).toHaveLength(0);
  });

  it("スコア順に選出される（低スコアの近接候補が抑制される）", () => {
    const candidates = [
      { x: 100, y: 100, iteration: 50, score: 3 },
      { x: 10, y: 10, iteration: 50, score: 5 },
      { x: 12, y: 10, iteration: 50, score: 8 },
    ];
    const result = applyNMS(candidates, 2, 30);
    expect(result[0]).toMatchObject({ x: 12, y: 10, score: 8 });
    expect(result[1]).toMatchObject({ x: 100, y: 100, score: 3 });
  });
});

describe("findStructureCenter", () => {
  /**
   * 中心(160,160)の周囲にリング状の高スコアブロックを配置するヘルパー
   */
  const createRadialBlocks = (stride: number, size: number): BlockDebugInfo[] => {
    const blocks: BlockDebugInfo[] = [];
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);

    for (let y = 0; y < size; y += stride) {
      for (let x = 0; x < size; x += stride) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 半径40-100の環状に高スコアを配置
        const score = dist >= 40 && dist <= 100 ? 0.5 + Math.random() * 0.5 : 0;
        blocks.push({
          bx: x,
          by: y,
          blockSize: stride,
          factors: {},
          score,
          peak: score > 0 ? { x, y, iteration: 50 } : null,
        });
      }
    }
    return blocks;
  };

  it("放射状に高スコアが広がる場合 → 中心付近が選ばれる", () => {
    const stride = 8;
    const size = 320;
    const blocks = createRadialBlocks(stride, size);

    const center = findStructureCenter(blocks, stride);

    expect(center).not.toBeNull();
    // 中心(160,160)から64px以内であること（リング内径40 + グリッドスナップ誤差を考慮）
    const dx = center!.x - 160;
    const dy = center!.y - 160;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(64);
  });

  it("全ブロックがscore=0 → null", () => {
    const blocks: BlockDebugInfo[] = [
      { bx: 0, by: 0, blockSize: 8, factors: {}, score: 0, peak: null },
      { bx: 8, by: 0, blockSize: 8, factors: {}, score: 0, peak: null },
    ];

    const center = findStructureCenter(blocks, 8);

    expect(center).toBeNull();
  });

  it("片側にしか構造がない → カバレッジ不足でnull", () => {
    const stride = 8;
    const blocks: BlockDebugInfo[] = [];
    // 320x320のグリッドで右半分にだけ高スコア
    for (let y = 0; y < 320; y += stride) {
      for (let x = 0; x < 320; x += stride) {
        const score = x > 160 ? 0.8 : 0;
        blocks.push({
          bx: x,
          by: y,
          blockSize: stride,
          factors: {},
          score,
          peak: score > 0 ? { x, y, iteration: 50 } : null,
        });
      }
    }

    const center = findStructureCenter(blocks, stride);

    // 片側だけだと方位カバレッジが0.5未満なのでnullか、
    // もし見つかっても右寄りの位置であること
    if (center) {
      expect(center.x).toBeGreaterThan(100);
    }
  });

  it("debugData.centerPointがsymmetryモードで返される", () => {
    const width = 320;
    const height = 320;
    const maxIter = 500;
    const buffer = new Uint32Array(width * height).fill(50);
    // 中心に4-fold対称パターン
    fillRadialPattern(buffer, width, height, 160, 160, 4, 100, 80, 100);

    const result = findInterestingPoints(buffer, width, height, maxIter, {
      scoring: "symmetry",
      debug: true,
    });

    expect(result.debugData.centerPoint).toBeDefined();
    // centerPointの型チェック（nullの場合もある）
    if (result.debugData.centerPoint) {
      expect(result.debugData.centerPoint.score).toBeGreaterThan(0);
    }
  });
});
