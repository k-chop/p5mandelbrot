export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// FIXME: もうちょっと賢く
export const divideRect = (
  rects: Rect[],
  expectedDivideCount: number,
  minSide = 100
): Rect[] => {
  if (rects.length > expectedDivideCount) {
    throw new Error("rects.length > expectedDivideCount");
  }

  const result: Rect[] = [];

  const areas = rects.map((rect) => rect.width * rect.height);
  const areaSum = areas.reduce((a, b) => a + b);
  const divideCounts = areas.map(
    (area) => Math.max(Math.floor((expectedDivideCount * area) / areaSum)),
    1
  );
  const totalDivideCount = divideCounts.reduce((a, b) => a + b);

  if (totalDivideCount > expectedDivideCount) {
    throw new Error("totalDivideCount > expectedDivideCount");
  }

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const divideCount = divideCounts[i];

    const endY = rect.y + rect.height;
    const endX = rect.x + rect.width;

    let sideX = minSide;
    let sideY = minSide;

    if (rect.width > rect.height) {
      sideX = Math.max(minSide, Math.ceil(rect.width / divideCount));
      sideY = rect.height;
    } else {
      sideX = rect.width;
      sideY = Math.max(minSide, Math.ceil(rect.height / divideCount));
    }

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
