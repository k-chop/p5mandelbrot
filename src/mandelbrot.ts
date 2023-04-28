import BigNumber from "bignumber.js";
import { divideRect, Rect } from "./rect";
import {
  MandelbrotParams,
  OffsetParams,
  ReferencePointResult,
  WorkerProgress,
  WorkerResult,
} from "./types";
import {
  activeWorkerCount,
  registerWorkerTask,
  terminateWorkers,
  cycleWorkerType,
  getWorkerCount,
  setWorkerType,
  referencePointWorker,
} from "./workers";
import {
  addIterationCache,
  clearIterationCache,
  translateRectInIterationCache,
} from "./aggregator";

const DEFAULT_N = 500;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;

export const GLITCHED_POINT_ITERATION = 4294967295;

let lastCalc: MandelbrotParams = {
  x: new BigNumber(0),
  y: new BigNumber(0),
  r: new BigNumber(0),
  N: 0,
  mode: "normal",
};

let running = false;

let completed = 0;
let lastTime = "0";

let width = DEFAULT_WIDTH;
let height = DEFAULT_HEIGHT;

const progresses = Array.from({ length: getWorkerCount() }, () => 0);

let currentParams: MandelbrotParams = {
  x: new BigNumber("-1.40867236936669836954369923114776611328125"),
  y: new BigNumber("0.13573367440664611574869923114776611328125"),
  r: new BigNumber("0.00000363797880709171295166015625"),
  N: DEFAULT_N,
  mode: "normal",
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

export const cloneParams = (params: MandelbrotParams): MandelbrotParams => ({
  ...params,
  x: BigNumber(params.x),
  y: BigNumber(params.y),
  r: BigNumber(params.r),
});

export const getProgressString = () =>
  ((progresses.reduce((p, c) => p + c) * 100) / activeWorkerCount()).toFixed();

export const getPreviousRenderTime = () => lastTime;

export const updateCurrentParams = () => {
  lastCalc = { ...currentParams };
};

export const setCurrentParams = (params: Partial<MandelbrotParams>) => {
  const needModeChange = currentParams.mode !== params.mode;

  currentParams = { ...currentParams, ...params };
  if (needModeChange) {
    setWorkerType(currentParams.mode);
    setOffsetParams({ x: 0, y: 0 });
  }
};

export const setOffsetParams = (params: Partial<OffsetParams>) => {
  offsetParams = { ...offsetParams, ...params };
};

export const resetIterationCount = () => setCurrentParams({ N: DEFAULT_N });
export const setDeepIterationCount = () =>
  setCurrentParams({ N: DEFAULT_N * 20 });

export const resetRadius = () => setCurrentParams({ r: new BigNumber("2.0") });

export const cycleMode = () => {
  const mode = cycleWorkerType();
  setCurrentParams({ mode });
  setOffsetParams({ x: 0, y: 0 });
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

export const zoom = (times: number) => {
  if (1 < times && currentParams.r.times(times).gte(5)) {
    return;
  }

  currentParams.r = currentParams.r.times(times);
  setOffsetParams({ x: 0, y: 0 });
};

export const paramsChanged = () => {
  return !isSameParams(lastCalc, currentParams);
};

export const startCalculation = (
  onBufferChanged: (updatedRect: Rect) => void
) => {
  updateCurrentParams();

  if (running) {
    terminateWorkers();
  }

  running = true;
  completed = 0;
  progresses.fill(0);

  const before = performance.now();

  const minSide = Math.floor(Math.sqrt((width * height) / getWorkerCount()));

  let calculationRects = divideRect(
    [{ x: 0, y: 0, width, height }],
    getWorkerCount(),
    minSide
  );

  if (offsetParams.x !== 0 || offsetParams.y !== 0) {
    const offsetX = offsetParams.x;
    const offsetY = offsetParams.y;

    // FIXME: 拡大待ち中や移動が終わる前に再度移動すると表示が壊れる
    // 拡大開始したときに既にCacheが消えてるからそりゃそうだ
    // なんとかせい

    // 移動した分の再描画範囲を計算
    const iterationBufferTransferedRect = {
      x: offsetX >= 0 ? 0 : Math.abs(offsetX),
      y: offsetY >= 0 ? 0 : Math.abs(offsetY),
      width: width - Math.abs(offsetX),
      height: height - Math.abs(offsetY),
    } satisfies Rect;

    // FIXME: キャッシュ側を毎回書き換えるのはどう考えても悪手
    translateRectInIterationCache(offsetX, offsetY);

    // 新しく計算しない部分を先に描画しておく
    onBufferChanged(iterationBufferTransferedRect);

    calculationRects = divideRect(getOffsetRects(), getWorkerCount(), minSide);
  } else {
    // 移動していない場合は再利用するCacheがないので消す
    clearIterationCache();
  }

  const refWorker = referencePointWorker();
  refWorker.addEventListener(
    "message",
    (ev: MessageEvent<ReferencePointResult>) => {
      const { type, glitchChecker, xn, xn2 } = ev.data;
      if (type !== "result") return;

      console.log(xn, xn2, glitchChecker);

      registerWorkerTask(
        calculationRects,
        (worker, rect, idx, _, isCompleted) => {
          const startX = rect.x;
          const endX = rect.x + rect.width;
          const startY = rect.y;
          const endY = rect.y + rect.height;

          const f = (ev: MessageEvent<WorkerResult | WorkerProgress>) => {
            const data = ev.data;
            if (data.type == "result") {
              const { iterations } = data;

              const iterationsResult = new Uint32Array(iterations);
              addIterationCache(rect, iterationsResult);

              progresses[idx] = 1.0;
              completed++;

              // TODO: たぶん適度にdebounceしたほうがいい
              onBufferChanged(rect);

              if (isCompleted(completed)) {
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
            pixelHeight: height,
            pixelWidth: width,
            startY,
            endY,
            startX,
            endX,
            xn,
            xn2,
            glitchChecker,
          });
        }
      );
    }
  );

  refWorker.postMessage({
    complexCenterX: currentParams.x.toString(),
    complexCenterY: currentParams.y.toString(),
    complexRadius: currentParams.r.toString(),
    maxIteration: currentParams.N,
    pixelHeight: height,
    pixelWidth: width,
  });
};

const isSameParams = (a: MandelbrotParams, b: MandelbrotParams) =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.N === b.N && a.mode === b.mode;

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
