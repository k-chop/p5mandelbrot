import BigNumber from "bignumber.js";
import { copyBufferRectToRect } from "./buffer";
import { divideRect, Rect } from "./rect";
import {
  MandelbrotParams,
  OffsetParams,
  WorkerProgress,
  WorkerResult,
} from "./types";
import {
  activeWorkerCount,
  registerWorkerTask,
  terminateWorkers,
  toggleWorkerType,
  getWorkerCount,
} from "./workers";

const DEFAULT_N = 500;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;

let lastCalc: MandelbrotParams = {
  x: new BigNumber(0),
  y: new BigNumber(0),
  r: new BigNumber(0),
  N: 0,
  R: 0,
};

let needsReCalculation = false;
let running = false;

let iterationTimeBuffer: Uint32Array;
let iterationTimeBufferTemp: Uint32Array;

let lastColorIdx = 0;
let currentColorIdx = 0;
let colorsArray: Uint8ClampedArray[];

let completed = 0;
let lastCompleted = 0;
let lastTime = "0";

let width = DEFAULT_WIDTH;
let height = DEFAULT_HEIGHT;

const progresses = Array.from({ length: getWorkerCount() }, () => 0);

let currentParams: MandelbrotParams = {
  x: new BigNumber("-1.40867236936669836954369923114776611328125"),
  y: new BigNumber("0.13573367440664611574869923114776611328125"),
  r: new BigNumber("0.00000363797880709171295166015625"),
  N: DEFAULT_N,
  R: 2,
};

let offsetParams: OffsetParams = {
  x: 0,
  y: 0,
};

export const calcVars = (
  mouseX: number,
  mouseY: number,
  width: number,
  height: number
) => {
  const normalizedMouseX = new BigNumber(2 * mouseX).div(width).minus(1);
  const normalizedMouseY = new BigNumber(2 * mouseY).div(height).minus(1);
  const currentMouseX = currentParams.x.plus(
    normalizedMouseX.times(currentParams.r)
  );
  const currentMouseY = currentParams.y.minus(
    normalizedMouseY.times(currentParams.r)
  );

  const r = currentParams.r;
  const N = currentParams.N;

  return {
    mouseX: currentMouseX,
    mouseY: currentMouseY,
    r,
    N,
  };
};

export const getCanvasSize = () => ({ width, height });

export const getCurrentParams = () => currentParams;

export const getProgressString = () =>
  ((progresses.reduce((p, c) => p + c) * 100) / activeWorkerCount()).toFixed();

export const getPreviousRenderTime = () => lastTime;

export const getIterationTimes = () => iterationTimeBuffer;

export const getIterationTimeAt = (x: number, y: number) => {
  const index = y * width + x;
  return iterationTimeBuffer[Math.floor(index)];
};

export const updateCurrentParams = () => {
  lastCalc = { ...currentParams };
};

export const setCurrentParams = (params: Partial<MandelbrotParams>) => {
  currentParams = { ...currentParams, ...params };
};

export const setOffsetParams = (params: Partial<OffsetParams>) => {
  offsetParams = { ...offsetParams, ...params };
};

export const resetIterationCount = () => setCurrentParams({ N: DEFAULT_N });
export const setDeepIterationCount = () =>
  setCurrentParams({ N: DEFAULT_N * 20 });

export const resetRadius = () => setCurrentParams({ r: new BigNumber("2.0") });

export const changeMode = () => {
  toggleWorkerType();
  setOffsetParams({ x: 0, y: 0 });
  needsReCalculation = true;
};

export const exportParamsToClipboard = () => {
  const { x, y, r } = currentParams;

  const str = JSON.stringify({
    x: x.toString(),
    y: y.toString(),
    r: r.toString(),
  });
  navigator.clipboard.writeText(str);
};

export const importParamsFromClipboard = () => {
  navigator.clipboard
    .readText()
    .then((s) => {
      const p = JSON.parse(s);
      if (p.x) currentParams.x = new BigNumber(p.x);
      if (p.y) currentParams.y = new BigNumber(p.y);
      if (p.r) currentParams.r = new BigNumber(p.r);
    })
    .catch(() => {
      console.log("Clipboard import failed.");
    });
};

export const initializeIterationBuffer = () => {
  const { width, height } = getCanvasSize();

  iterationTimeBuffer = new Uint32Array(height * width);
  iterationTimeBufferTemp = new Uint32Array(height * width);
};

export const setColorsArray = (colors: Uint8ClampedArray[]) => {
  colorsArray = colors;
};

export const setColorIndex = (index: number) => {
  if (colorsArray[index]) {
    currentColorIdx = index;
  } else {
    currentColorIdx = 0;
  }
};

export const getPalette = () => colorsArray[currentColorIdx];

export const zoom = (times: number) => {
  if (1 < times && currentParams.r.times(times).gte(5)) {
    return;
  }

  currentParams.r = currentParams.r.times(times);
  setOffsetParams({ x: 0, y: 0 });
};

export const shouldDrawCompletedArea = () => {
  const hasNewCompletedArea = lastCompleted !== completed;

  return (
    running &&
    hasNewCompletedArea &&
    !needsReCalculation &&
    isSameParams(lastCalc, currentParams)
  );
};

export const shouldDrawColorChanged = () => {
  return (
    !needsReCalculation &&
    isSameParams(lastCalc, currentParams) &&
    lastColorIdx !== currentColorIdx
  );
};

export const shouldDrawWithoutRecolor = () => {
  return !needsReCalculation && isSameParams(lastCalc, currentParams);
};

export const updateColor = () => {
  lastColorIdx = currentColorIdx;
};

export const startCalculation = (onComplete: () => void) => {
  updateCurrentParams();

  if (running) {
    terminateWorkers();
  }

  needsReCalculation = false;
  running = true;
  completed = 0;
  lastCompleted = -1;
  progresses.fill(0);

  const before = performance.now();

  const minSide = Math.sqrt((width * height) / getWorkerCount());

  let calculationRects = divideRect(
    [{ x: 0, y: 0, width, height }],
    getWorkerCount(),
    minSide
  );

  if (offsetParams.x !== 0 || offsetParams.y !== 0) {
    const offsetX = offsetParams.x;
    const offsetY = offsetParams.y;

    // 拡大待ち中や移動が終わる前に再度移動すると表示が壊れる
    // 進捗を直接表示用のバッファに直接書き込んでるからだと思われる
    // なんとかせい

    copyBufferRectToRect(
      iterationTimeBufferTemp,
      iterationTimeBuffer,
      width,
      width,
      width - Math.abs(offsetX),
      height - Math.abs(offsetY),
      Math.abs(Math.min(0, offsetX)),
      Math.abs(Math.min(0, offsetY)),
      Math.max(0, offsetX),
      Math.max(0, offsetY)
    );

    swapIterationTimeBuffer();

    calculationRects = divideRect(getOffsetRects(), getWorkerCount(), minSide);
  }

  registerWorkerTask(calculationRects, (worker, rect, idx, _, isCompleted) => {
    const startX = rect.x;
    const endX = rect.x + rect.width;
    const startY = rect.y;
    const endY = rect.y + rect.height;

    const f = (ev: MessageEvent<WorkerResult | WorkerProgress>) => {
      const data = ev.data;
      if (data.type == "result") {
        const { iterations } = data;

        const iterationsResult = new Uint32Array(iterations);

        copyBufferRectToRect(
          iterationTimeBuffer,
          iterationsResult,
          width,
          rect.width,
          rect.width,
          rect.height,
          rect.x,
          rect.y,
          0,
          0
        );

        progresses[idx] = 1.0;
        completed++;

        if (isCompleted(completed)) {
          onComplete();

          running = false;
          const after = performance.now();
          lastTime = (after - before).toFixed();
        }

        worker.removeEventListener("message", f);
      } else {
        const { progress } = data;
        progresses[idx] = progress;
      }
    };

    worker.addEventListener("message", f);
    worker.addEventListener("error", () => {
      completed++;
    });

    worker.postMessage({
      cx: currentParams.x.toString(),
      cy: currentParams.y.toString(),
      r: currentParams.r.toString(),
      N: currentParams.N,
      row: height,
      col: width,
      R2: currentParams.R * currentParams.R,
      startY,
      endY,
      startX,
      endX,
      palette: getPalette(),
    });
  });
};

const isSameParams = (a: MandelbrotParams, b: MandelbrotParams) =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.N === b.N && a.R === b.R;

const getOffsetRects = (): Rect[] => {
  const offsetX = offsetParams.x;
  const offsetY = offsetParams.y;

  const rects: Rect[] = [];

  if (offsetY !== 0) {
    // (1) 上下の横長矩形（offsetYが0なら存在しない）
    rects.push({
      x: 0,
      y: offsetY > 0 ? height - offsetY : 0,
      width,
      height: Math.abs(offsetY),
    });
  }
  if (offsetX !== 0) {
    // (2) 1に含まれる分を除いた左右の縦長矩形（offsetXが0なら存在しない）
    rects.push({
      x: offsetX > 0 ? width - offsetX : 0,
      y: offsetY > 0 ? 0 : Math.abs(offsetY),
      width: Math.abs(offsetX),
      height: height - Math.abs(offsetY),
    });
  }

  return rects;
};

const swapIterationTimeBuffer = () => {
  [iterationTimeBuffer, iterationTimeBufferTemp] = [
    iterationTimeBufferTemp,
    iterationTimeBuffer,
  ];
};
