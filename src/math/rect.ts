import type BigNumber from "bignumber.js";
import { getOffsetParams } from "../mandelbrot-state/mandelbrot-state";
import type { OffsetParams } from "../types";

/** workerに渡す領域の最低サイズ。あまり小さくすると計算がうまくいかないことがある */
const DIVIDE_MIN_SIZE_PIXEL = 80;

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

/**
 * 描画したい領域を受け取り、各workerが計算を実行するため領域を返す
 *
 * 返される各領域は `minSide` で一辺の長さが保証されている。
 * 極端に小さい領域だと計算に失敗してしまうことがあるため
 * 長さを保証するために、画面外にはみ出したり他の領域と重なることを許容している
 */
export const calcTargetRectsFromOffsetRects = (
  rects: Rect[],
  expectedDivideCount: number,
  _minSide = DIVIDE_MIN_SIZE_PIXEL,
): Rect[] => {
  const minSide = Math.max(_minSide, DIVIDE_MIN_SIZE_PIXEL);

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
 * 描画対象のRectを計算して返す。外からは基本これを呼べばよい
 *
 * 各workerへ渡すrectは最低保証サイズがあるため、画面外にはみだしたり他のrectと重なり得る。
 */
export const getCalculationTargetRects = (
  canvasWidth: number,
  canvasHeight: number,
  divideRectCount: number,
  offsetParams: OffsetParams,
) => {
  if (offsetParams.x !== 0 || offsetParams.y !== 0) {
    // offsetがある(moveした)場合は動かした部分だけ描画すればよい
    const expectedDivideCount = Math.max(divideRectCount, 2);
    return calcTargetRectsFromOffsetRects(
      getOffsetRects(canvasWidth, canvasHeight),
      expectedDivideCount,
    );
  } else {
    return calcTargetRectsFromOffsetRects(
      [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }],
      divideRectCount,
    );
  }
};
