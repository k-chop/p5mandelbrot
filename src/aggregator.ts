import { Rect } from "./rect";
import { IterationBuffer } from "./types";

let iterationBuffer: IterationBuffer[] = [];

export const addIterationBuffer = (rect: Rect, buffer: Uint32Array): void => {
  iterationBuffer.push({ rect, buffer });
};

export const getIterationBuffers = (): IterationBuffer[] => {
  return iterationBuffer;
};

export const clearIterationBuffer = (): void => {
  iterationBuffer = [];
};

export const translateIterationBuffer = (
  offsetX: number,
  offsetY: number
): void => {
  console.log(offsetX, offsetY);
  iterationBuffer = iterationBuffer.map((iteration) => {
    return {
      rect: {
        x: iteration.rect.x - offsetX,
        y: iteration.rect.y - offsetY,
        width: iteration.rect.width,
        height: iteration.rect.height,
      },
      buffer: iteration.buffer,
    };
  });
};
