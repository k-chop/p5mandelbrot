import BigNumber from "bignumber.js";

/** pixel単位の矩形 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 複素数平面座標の矩形 */
export type ComplexRect = {
  x: BigNumber;
  y: BigNumber;
  width: BigNumber;
  height: BigNumber;
};

/**
 * ピクセル座標 (px, py) → 複素数平面 (zx, zy)
 */
export function pixelToComplex(
  px: number,
  py: number,
  cx: BigNumber,
  cy: BigNumber,
  r: BigNumber,
  canvasWidth: number,
  canvasHeight: number,
) {
  // ピクセルの中心を 0 とし、[-1, +1] に正規化
  //  px: canvasWidth/2 → 0, px: 0 → -1, px: canvasWidth → +1
  const nx = new BigNumber(px - canvasWidth / 2).div(canvasWidth / 2);
  //  py: canvasHeight/2 → 0, py: 0 → -1, py: canvasHeight → +1
  const ny = new BigNumber(py - canvasHeight / 2).div(canvasHeight / 2);

  // zx = cx + nx * r
  // zy = cy - ny * r  (上下反転)
  const zx = cx.plus(nx.multipliedBy(r));
  const zy = cy.minus(ny.multipliedBy(r));

  return { zx, zy };
}

/**
 * 複素数平面 (zx, zy) → ピクセル座標 (px, py)
 */
export function complexToPixel(
  zx: BigNumber,
  zy: BigNumber,
  cx: BigNumber,
  cy: BigNumber,
  r: BigNumber,
  canvasWidth: number,
  canvasHeight: number,
) {
  // zx - cx の範囲 [-r, +r] をピクセルの [-canvasWidth/2, +canvasWidth/2] に線形マップ
  // → 最終的に [0, canvasWidth] の座標へ
  const px = zx
    .minus(cx)
    .div(r)
    .multipliedBy(canvasWidth / 2)
    .plus(canvasWidth / 2);

  // zy - cy の範囲 [-r, +r] をピクセルの [+canvasHeight/2, -canvasHeight/2] に線形マップ
  // → 最終的に [0, canvasHeight] の座標へ (y は上下反転のため cy - zy)
  const py = cy
    .minus(zy)
    .div(r)
    .multipliedBy(canvasHeight / 2)
    .plus(canvasHeight / 2);

  return { px, py };
}

/**
 * ピクセル座標の Rect → 複素数平面の Rect
 *  - rect.x, rect.y, rect.width, rect.height
 *    はピクセルベースの "左上の (x,y) + 幅 & 高さ"
 */
export function convertToComplexRect(
  cx: BigNumber,
  cy: BigNumber,
  rect: Rect,
  canvasWidth: number,
  canvasHeight: number,
  r: BigNumber,
): ComplexRect {
  // 左上と右下ピクセルをそれぞれ複素数平面座標へ
  const topLeft = pixelToComplex(
    rect.x,
    rect.y,
    cx,
    cy,
    r,
    canvasWidth,
    canvasHeight,
  );
  const bottomRight = pixelToComplex(
    rect.x + rect.width,
    rect.y + rect.height,
    cx,
    cy,
    r,
    canvasWidth,
    canvasHeight,
  );

  // topLeft.zx, topLeft.zy が左上、bottomRight.zx, bottomRight.zy が右下
  // ただし複素平面は y が小さい方が上、大きい方が下
  // ここでは「Rect でも (x, y) は左上とし、width, height が正になるようにする」
  const x = topLeft.zx; // 左
  const y = topLeft.zy; // 上
  const width = bottomRight.zx.minus(topLeft.zx); // (右 - 左)
  const height = bottomRight.zy.minus(topLeft.zy); // (下 - 上)

  return {
    x,
    y,
    width,
    height,
  };
}

/**
 * 複素数平面の Rect → ピクセル座標の Rect
 *  - complexRect.x, complexRect.y, complexRect.width, complexRect.height
 *    は複素数平面での左上の (x,y) + 幅 & 高さ
 */
export function convertToPixelRect(
  cx: BigNumber,
  cy: BigNumber,
  complexRect: ComplexRect,
  canvasWidth: number,
  canvasHeight: number,
  r: BigNumber,
): Rect {
  // 左上（x, y）をピクセルへ
  const topLeft = complexToPixel(
    complexRect.x,
    complexRect.y,
    cx,
    cy,
    r,
    canvasWidth,
    canvasHeight,
  );
  // 右下（x + width, y + height）をピクセルへ
  const bottomRight = complexToPixel(
    complexRect.x.plus(complexRect.width),
    complexRect.y.plus(complexRect.height),
    cx,
    cy,
    r,
    canvasWidth,
    canvasHeight,
  );

  // 画面上で左上が (x1, y1)、右下が (x2, y2) になるように整形する
  const x1 = topLeft.px.toNumber();
  const y1 = topLeft.py.toNumber();
  const x2 = bottomRight.px.toNumber();
  const y2 = bottomRight.py.toNumber();

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return {
    x: left,
    y: top,
    width,
    height,
  };
}

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
