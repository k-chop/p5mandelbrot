import type { InterestingPoint } from "../find-interesting-points";
import type { ScoreMap } from "../peak-detector";
import { encodePNG } from "./png";

/** 期待点（正解データ）。tolerance 以内にマーカーがあれば検出成功とみなす */
export interface ExpectedPoint {
  x: number;
  y: number;
  note?: string;
}

type RGB = [number, number, number];

/** 色相を何周させるか（画像内の iteration 値域に対して） */
const HUE_CYCLES = 16;

/**
 * 画像内の iteration 値域（p1〜p99）を HUE_CYCLES 周の色相に写す簡易パレット。集合内部は黒。
 * 深いズームでは値域が狭いので、絶対値ではなく値域に対して周期を取る
 */
const colorOf = (iter: number, maxIteration: number, lo: number, hi: number): RGB => {
  if (iter === 0 || iter >= maxIteration) return [0, 0, 0];
  const t = (((((iter - lo) / (hi - lo)) * HUE_CYCLES) % 1) + 1) % 1;
  const h = t * 6;
  const f = h - Math.floor(h);
  const q = 1 - f;
  const i = Math.floor(h) % 6;
  const [r, g, b] = [
    [1, f, 0],
    [q, 1, 0],
    [0, 1, f],
    [0, q, 1],
    [f, 0, 1],
    [1, 0, q],
  ][i];
  return [Math.round(60 + r * 180), Math.round(60 + g * 180), Math.round(60 + b * 180)];
};

const setPixel = (
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  c: RGB,
) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  rgba[i] = c[0];
  rgba[i + 1] = c[1];
  rgba[i + 2] = c[2];
  rgba[i + 3] = 255;
};

const drawCircle = (
  rgba: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  c: RGB,
) => {
  const steps = Math.ceil(radius * 8);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    for (const w of [0, 0.7]) {
      setPixel(
        rgba,
        width,
        height,
        Math.round(cx + (radius + w) * Math.cos(a)),
        Math.round(cy + (radius + w) * Math.sin(a)),
        c,
      );
    }
  }
};

const drawCross = (
  rgba: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  size: number,
  c: RGB,
) => {
  // 黒の太い十字の上に細い十字を重ね、どのパレット色の上でも見えるようにする
  for (let d = -size; d <= size; d++) {
    for (let w = -1; w <= 1; w++) {
      setPixel(rgba, width, height, cx + d, cy + w, [0, 0, 0]);
      setPixel(rgba, width, height, cx + w, cy + d, [0, 0, 0]);
    }
  }
  for (let d = -size; d <= size; d++) {
    setPixel(rgba, width, height, cx + d, cy, c);
    setPixel(rgba, width, height, cx, cy + d, c);
  }
};

/**
 * iteration buffer を着色し、検出結果（白リング、順位が高いほど大きい）と
 * 期待点（黒縁の白い十字）を重ねた RGBA バッファを返す
 */
export const renderSceneRGBA = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  points: InterestingPoint[],
  expected: ExpectedPoint[],
): Uint8Array => {
  const valid = Array.from(buffer.filter((v) => v !== 0 && v < maxIteration)).sort((a, b) => a - b);
  const lo = valid[Math.floor(valid.length * 0.01)] ?? 0;
  const hi = Math.max(lo + 1, valid[Math.floor(valid.length * 0.99)] ?? 1);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const c = colorOf(buffer[i], maxIteration, lo, hi);
    rgba[i * 4] = c[0];
    rgba[i * 4 + 1] = c[1];
    rgba[i * 4 + 2] = c[2];
    rgba[i * 4 + 3] = 255;
  }
  // 座標の目安用グリッド（100px ごと、画像中央は少し濃く）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x % 100 !== 0 && y % 100 !== 0) continue;
      const strong = x === Math.floor(width / 2) || y === Math.floor(height / 2);
      const i = (y * width + x) * 4;
      const a = strong ? 0.6 : 0.3;
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k] * (1 - a) + 255 * a);
    }
  }
  for (const e of expected) drawCross(rgba, width, height, e.x, e.y, 9, [255, 255, 255]);
  points.forEach((p, rank) => {
    const radius = Math.max(6, 16 - rank);
    drawCircle(rgba, width, height, p.x, p.y, radius + 1.5, [0, 0, 0]);
    drawCircle(rgba, width, height, p.x, p.y, radius, [255, 255, 255]);
  });
  return rgba;
};

/**
 * renderSceneRGBA の結果を PNG にエンコードして返す
 */
export const renderScene = (
  buffer: Uint32Array,
  width: number,
  height: number,
  maxIteration: number,
  points: InterestingPoint[],
  expected: ExpectedPoint[],
): Buffer =>
  encodePNG(renderSceneRGBA(buffer, width, height, maxIteration, points, expected), width, height);

/**
 * ピークスコアマップをヒートマップ（黒 → 青 → 緑 → 黄 → 赤）にして、検出結果と期待点を重ねた PNG を返す。
 * 色はマップ内の最大スコアで正規化する
 */
export const renderHeatmap = (
  map: ScoreMap,
  width: number,
  height: number,
  points: InterestingPoint[],
  expected: ExpectedPoint[],
): Buffer => {
  let max = 0;
  for (const v of map.score) if (v > max) max = v;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = Math.min(map.cols - 1, Math.floor(x / map.stride));
      const gy = Math.min(map.rows - 1, Math.floor(y / map.stride));
      const t = max > 0 ? map.score[gy * map.cols + gx] / max : 0;
      const stops: RGB[] = [
        [0, 0, 0],
        [0, 0, 255],
        [0, 255, 0],
        [255, 255, 0],
        [255, 0, 0],
      ];
      const pos = t * (stops.length - 1);
      const i0 = Math.min(stops.length - 2, Math.floor(pos));
      const f = pos - i0;
      const c: RGB = [0, 1, 2].map((k) =>
        Math.round(stops[i0][k] * (1 - f) + stops[i0 + 1][k] * f),
      ) as RGB;
      setPixel(rgba, width, height, x, y, c);
    }
  }
  for (const e of expected) drawCross(rgba, width, height, e.x, e.y, 9, [255, 255, 255]);
  points.forEach((p, rank) => {
    const radius = Math.max(6, 16 - rank);
    drawCircle(rgba, width, height, p.x, p.y, radius, [255, 255, 255]);
  });
  return encodePNG(rgba, width, height);
};
