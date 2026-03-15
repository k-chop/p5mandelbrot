import type BigNumber from "bignumber.js";
import { getOffsetParams } from "../mandelbrot-state/mandelbrot-state";
import type { OffsetParams } from "../types";

const DIVIDE_MIN_SIZE = 80; // px

/** pixel単位の矩形 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 複素数平面座標の矩形 */
export type RealRect = {
  topLeftX: BigNumber;
  topLeftY: BigNumber;
  bottomRightX: BigNumber;
  bottomRightY: BigNumber;
};

export const calculateRealRect = (
  cx: BigNumber,
  cy: BigNumber,
  rect: Rect,
  canvasWidth: number,
  canvasHeight: number,
  r: BigNumber,
): RealRect => {
  const topLeftX = cx.plus((rect.x * 2) / canvasWidth - 1.0).times(r);
  const topLeftY = cy.minus((rect.y * 2) / canvasHeight - 1.0).times(r);
  const bottomRightX = cx.plus(((rect.x + rect.width) * 2) / canvasWidth - 1.0).times(r);
  const bottomRightY = cy.minus(((rect.y + rect.height) * 2) / canvasHeight - 1.0).times(r);

  return {
    topLeftX,
    topLeftY,
    bottomRightX,
    bottomRightY,
  };
};

export const calculateDivideArea = (
  divideCount: number,
): { longSideCount: number; shortSideCount: number } => {
  let longSideCount = 1;
  let shortSideCount = 1;
  const limit = Math.sqrt(divideCount);

  for (let i = 2; i == 2 || i <= limit; i += 2) {
    if (divideCount % i === 0) {
      const j = divideCount / i;
      const initialValue = longSideCount === 1 && shortSideCount === 1;

      if (i === j && !initialValue) {
        longSideCount = shortSideCount = i;
      } else if (
        initialValue ||
        (Math.abs(i - j) <= longSideCount - shortSideCount && !initialValue)
      ) {
        longSideCount = Math.max(i, j);
        shortSideCount = Math.min(i, j);
      }
    }
  }

  return {
    longSideCount,
    shortSideCount,
  };
};

export const divideRect = (rects: Rect[], expectedDivideCount: number, minSide = 1): Rect[] => {
  if (rects.length > expectedDivideCount) {
    throw new Error("rects.length > expectedDivideCount");
  }

  const result: Rect[] = [];

  const areas = rects.map((rect) => rect.width * rect.height);
  const areaSum = areas.reduce((a, b) => a + b);
  const divideCounts = areas.map((area) => {
    const count = Math.max(Math.floor((expectedDivideCount * area) / areaSum), 1);
    // 各エリアの分割数は1もしくは偶数にする
    return count % 2 === 0 || count === 1 ? count : count + 1;
  });

  // 合計がexpectedDivideCountを下回るように大きいやつから引いていく
  while (expectedDivideCount < divideCounts.reduce((a, b) => a + b)) {
    const max = Math.max(...divideCounts);
    const idx = divideCounts.findIndex((v) => v === max);

    divideCounts[idx] = Math.max(divideCounts[idx] - 2, 1);
  }

  const totalDivideCount = divideCounts.reduce((a, b) => a + b);

  if (expectedDivideCount < totalDivideCount) {
    throw new Error("totalDivideCount > expectedDivideCount");
  }

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const divideCount = divideCounts[i];

    const { longSideCount, shortSideCount } = calculateDivideArea(divideCount);

    // 入力rectの各辺がminSide未満なら拡張（キャンバスはみ出し許容）
    const width = Math.max(rect.width, minSide);
    const height = Math.max(rect.height, minSide);

    const endY = rect.y + height;
    const endX = rect.x + width;

    const sideXCount = width > height ? longSideCount : shortSideCount;
    const sideYCount = width > height ? shortSideCount : longSideCount;

    const sideX = Math.max(minSide, Math.ceil(width / sideXCount));
    const sideY = Math.max(minSide, Math.ceil(height / sideYCount));

    for (let y = rect.y; y < endY; ) {
      const remainY = endY - y;
      const h = remainY <= sideY ? remainY : remainY - sideY < minSide ? remainY : sideY;
      for (let x = rect.x; x < endX; ) {
        const remainX = endX - x;
        const w = remainX <= sideX ? remainX : remainX - sideX < minSide ? remainX : sideX;
        result.push({ x, y, width: w, height: h });
        x += w;
      }
      y += h;
    }
  }

  return result;
};

/**
 * ドラッグ移動時の差分描画領域を計算する
 *
 * offsetParams（移動量）に基づき、キャンバス端に露出した未計算領域を矩形として返す。
 */
export const getOffsetRects = (
  canvasWidth: number,
  canvasHeight: number,
  offsetParams = getOffsetParams(),
): Rect[] => {
  const offsetX = offsetParams.x;
  const offsetY = offsetParams.y;

  const rects: Rect[] = [];

  const absOffsetY = Math.abs(offsetY);
  const absOffsetX = Math.abs(offsetX);

  if (offsetY !== 0) {
    rects.push({
      x: 0,
      y: offsetY > 0 ? canvasHeight - absOffsetY : 0,
      width: canvasWidth,
      height: absOffsetY,
    });
  }
  if (offsetX !== 0) {
    rects.push({
      x: offsetX > 0 ? canvasWidth - absOffsetX : 0,
      y: offsetY > 0 ? 0 : absOffsetY,
      width: absOffsetX,
      height: canvasHeight - absOffsetY,
    });
  }

  return rects;
};

/**
 * 描画対象のRectを計算する
 *
 * offsetがある場合は描画範囲を狭くできる
 */
export const getCalculationTargetRects = (
  canvasWidth: number,
  canvasHeight: number,
  divideRectCount: number,
  offsetParams: OffsetParams,
) => {
  if (offsetParams.x !== 0 || offsetParams.y !== 0) {
    const expectedDivideCount = Math.max(divideRectCount, 2);
    return divideRect(
      getOffsetRects(canvasWidth, canvasHeight),
      expectedDivideCount,
      DIVIDE_MIN_SIZE,
    );
  } else {
    // FIXME: 縮小する場合にもっと小さくできる
    return divideRect(
      [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }],
      divideRectCount,
      DIVIDE_MIN_SIZE,
    );
  }
};
