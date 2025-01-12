import BigNumber from "bignumber.js";
import { getOffsetParams } from "../mandelbrot-state/mandelbrot-state";
import type { OffsetParams } from "../types";

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
  const bottomRightX = cx
    .plus(((rect.x + rect.width) * 2) / canvasWidth - 1.0)
    .times(r);
  const bottomRightY = cy
    .minus(((rect.y + rect.height) * 2) / canvasHeight - 1.0)
    .times(r);

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

export const divideRect = (
  rects: Rect[],
  expectedDivideCount: number,
  minSide = 1,
): Rect[] => {
  if (rects.length > expectedDivideCount) {
    throw new Error("rects.length > expectedDivideCount");
  }

  const result: Rect[] = [];

  const areas = rects.map((rect) => rect.width * rect.height);
  const areaSum = areas.reduce((a, b) => a + b);
  const divideCounts = areas.map((area) => {
    const count = Math.max(
      Math.floor((expectedDivideCount * area) / areaSum),
      1,
    );
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

    const endY = rect.y + rect.height;
    const endX = rect.x + rect.width;

    const sideXCount =
      rect.width > rect.height ? longSideCount : shortSideCount;
    const sideYCount =
      rect.width > rect.height ? shortSideCount : longSideCount;

    const sideX = Math.max(minSide, Math.ceil(rect.width / sideXCount));
    const sideY = Math.max(minSide, Math.ceil(rect.height / sideYCount));

    for (let y = rect.y; y < endY; y += sideY) {
      for (let x = rect.x; x < endX; x += sideX) {
        const width = Math.min(sideX, endX - x);
        const height = Math.min(sideY, endY - y);
        result.push({ x, y, width, height });
      }
    }
  }

  return result;
};

export const getOffsetRects = (
  canvasWidth: number,
  canvasHeight: number,
  offsetParams = getOffsetParams(),
): Rect[] => {
  const offsetX = offsetParams.x;
  const offsetY = offsetParams.y;

  const rects: Rect[] = [];

  if (offsetY !== 0) {
    // (1) 上下の横長矩形（offsetYが0なら存在しない）
    rects.push({
      x: 0,
      y: offsetY > 0 ? canvasHeight - offsetY : 0,
      width: canvasWidth,
      height: Math.abs(offsetY),
    });
  }
  if (offsetX !== 0) {
    // (2) 1に含まれる分を除いた左右の縦長矩形（offsetXが0なら存在しない）
    rects.push({
      x: offsetX > 0 ? canvasWidth - offsetX : 0,
      y: offsetY > 0 ? 0 : Math.abs(offsetY),
      width: Math.abs(offsetX),
      height: canvasHeight - Math.abs(offsetY),
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
    );
  } else {
    // FIXME: 縮小する場合にもっと小さくできる
    return divideRect(
      [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }],
      divideRectCount,
    );
  }
};
