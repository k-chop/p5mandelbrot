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
