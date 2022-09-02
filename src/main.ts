import "./style.css";
import p5 from "p5";
import { BigNumber } from "bignumber.js";
import { buildColors } from "./color";

interface WorkerResult {
  type: "result";
  pixels: ArrayBuffer;
  iterations: ArrayBuffer;
}

interface WorkerProgress {
  type: "progress";
  progress: number;
}

interface MandelBrotParams {
  x: BigNumber;
  y: BigNumber;
  r: BigNumber;
  N: number;
  R: number;
}

export interface WorkerParams {
  row: number;
  col: number;
  cx: string;
  cy: string;
  r: string;
  R2: number;
  N: number;
  start: number;
  end: number;
  palette: Uint8ClampedArray;
}

const DEFAULT_N = 500;
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 900;
const WORKER_COUNT = 64;

const currentParams: MandelBrotParams = {
  x: new BigNumber("-1.40867236936669836954369923114776611328125"),
  y: new BigNumber("0.13573367440664611574869923114776611328125"),
  r: new BigNumber("0.00000363797880709171295166015625"),
  N: DEFAULT_N,
  R: 2,
};

const workers: Worker[] = [];
type WorkerType = "normal" | "doublejs";
const workerPaths: Record<WorkerType, URL> = {
  normal: new URL("./worker.ts", import.meta.url),
  doublejs: new URL("./doublejs-worker.ts", import.meta.url),
};
const estimateWorkerType = (): WorkerType => {
  if (currentParams.r.lt(new BigNumber("1.0e-14"))) {
    return "doublejs";
  }
  return "normal";
};
let currentWorkerType: WorkerType = estimateWorkerType();

const resetWorker = (type: WorkerType) => {
  workers.forEach((worker) => worker.terminate());
  workers.splice(0);

  for (let i = 0; i < WORKER_COUNT; i++) {
    const path = workerPaths[type];
    workers.push(new Worker(path, { type: "module" }));
  }
};

resetWorker(currentWorkerType);

let currentColorIdx = 0;

const isSameParams = (a: MandelBrotParams, b: MandelBrotParams) =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.N === b.N && a.R === b.R;

const calcVars = (p: p5) => {
  const normalizedMouseX = new BigNumber(2 * p.mouseX).div(p.width).minus(1);
  const normalizedMouseY = new BigNumber(2 * p.mouseY).div(p.height).minus(1);
  const mouseX = currentParams.x.plus(normalizedMouseX.times(currentParams.r));
  const mouseY = currentParams.y.minus(normalizedMouseY.times(currentParams.r));

  const r = currentParams.r;
  const N = currentParams.N;

  return {
    mouseX,
    mouseY,
    r,
    N,
  };
};

const drawInfo = (
  p: p5,
  vars: ReturnType<typeof calcVars>,
  millis: string,
  progress: string,
  iterationsBuffer: Uint32Array
) => {
  const { mouseX, mouseY, r, N } = vars;
  p.fill(0, 35);
  p.rect(5, 5, DEFAULT_WIDTH - 10, 80);
  p.rect(5, DEFAULT_HEIGHT - 25, DEFAULT_WIDTH - 10, 22);
  p.fill(255);

  const pixelIdx = p.mouseX + p.mouseY * p.width;
  const iteration = iterationsBuffer[Math.floor(pixelIdx)];

  const ifInside = (val: { toString: () => String }) => {
    return isInside(p) ? val.toString() : "-";
  };

  p.text(
    `centerX: ${currentParams.x}\nmouseX: ${ifInside(mouseX)}\ncenterY: ${
      currentParams.y
    }\nmouseY: ${ifInside(mouseY)}\nr: ${r.toPrecision(
      10
    )}, N: ${N}, iteration: ${ifInside(iteration)}, mode: ${currentWorkerType}`,
    10,
    20
  );

  if (progress !== "100") {
    p.text(`Generating... ${progress}%`, 10, DEFAULT_HEIGHT - 10);
  } else {
    p.text(`Done! time: ${millis}ms`, 10, DEFAULT_HEIGHT - 10);
  }
};

const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

const sketch = (p: p5) => {
  let buffer: p5.Graphics;
  let lastCalc: MandelBrotParams = {
    x: new BigNumber(0),
    y: new BigNumber(0),
    r: new BigNumber(0),
    N: 0,
    R: 0,
  };
  let shouldRedraw = false;
  let lastColorIdx = 0;
  let lastTime = "0";
  let iterationTimeBuffer: Uint32Array;
  let canvasArrayBuffer: Uint8ClampedArray;
  let running = false;
  let colorsArray: Uint8ClampedArray[];
  let completed = 0;
  const progresses = Array.from({ length: workers.length }, () => 0);

  p.setup = () => {
    p.createCanvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    buffer = p.createGraphics(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    p.pixelDensity(1);
    iterationTimeBuffer = new Uint32Array(buffer.height * buffer.width);
    canvasArrayBuffer = new Uint8ClampedArray(buffer.height * buffer.width * 4);

    p.noStroke();
    p.colorMode(p.HSB, 360, 100, 100, 100);
    colorsArray = buildColors(p);
  };

  p.mouseClicked = () => {
    if (!isInside(p)) return;
    const { mouseX, mouseY } = calcVars(p);

    currentParams.x = mouseX;
    currentParams.y = mouseY;
  };

  p.mouseWheel = (event: { deltaY: number }) => {
    if (!isInside(p)) return;
    const { mouseX, mouseY } = calcVars(p);

    if (p.keyIsDown(p.SHIFT)) {
      currentParams.x = mouseX;
      currentParams.y = mouseY;
    }

    if (event) {
      if (event.deltaY > 0) {
        if (currentParams.r.times(2).lt(5)) {
          currentParams.r = currentParams.r.times(2);
        }
      } else {
        currentParams.r = currentParams.r.times(0.5);
      }
    }
  };

  p.keyPressed = (event: KeyboardEvent | undefined) => {
    if (event) {
      let diff = 100;

      if (event.shiftKey) {
        const N = currentParams.N;
        if (N < 1000) {
          diff = 100;
        } else if (N < 10000) {
          diff = 1000;
        } else if (N < 100000) {
          diff = 10000;
        } else {
          diff = 100000;
        }
      }
      if (event.key === "1") currentColorIdx = 0;
      if (event.key === "2") currentColorIdx = 1;
      if (event.key === "3") currentColorIdx = 2;
      if (event.key === "4") currentColorIdx = 3;
      if (event.key === "5") currentColorIdx = 4;
      if (event.key === "0") currentParams.N = DEFAULT_N;
      if (event.key === "9") currentParams.N = DEFAULT_N * 20;
      if (event.key === "m") {
        currentWorkerType =
          currentWorkerType === "normal" ? "doublejs" : "normal";
        resetWorker(currentWorkerType);
        shouldRedraw = true;
      }
      if (event.key === "o") {
        const { x, y, r } = currentParams;
        const str = JSON.stringify({
          x: x.toString(),
          y: y.toString(),
          r: r.toString(),
        });
        navigator.clipboard.writeText(str);
      }
      if (event.key === "i") {
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
      }
      if (event.key === "ArrowRight") currentParams.N += diff;
      if (event.key === "ArrowLeft") currentParams.N -= diff;
    }
  };

  p.draw = () => {
    const row = buffer.height;
    const col = buffer.width;

    const vars = calcVars(p);
    const R2 = currentParams.R * currentParams.R;

    if (
      !shouldRedraw &&
      isSameParams(lastCalc, currentParams) &&
      currentColorIdx === lastColorIdx
    ) {
      p.background(0);
      p.image(buffer, 0, 0);
      drawInfo(
        p,
        vars,
        lastTime,
        ((progresses.reduce((p, c) => p + c) * 100) / workers.length).toFixed(),
        iterationTimeBuffer
      );
      return;
    }
    lastCalc = { ...currentParams };
    lastColorIdx = currentColorIdx;

    if (running) {
      workers.forEach((worker) => worker.terminate());
      resetWorker(currentWorkerType);
    }

    shouldRedraw = false;
    running = true;
    completed = 0;
    progresses.fill(0);
    const before = performance.now();

    const singleRow = Math.floor(row / workers.length);
    let currentRowOffset = 0;
    workers.forEach((worker, idx) => {
      const isLast = idx === workers.length - 1;
      const start = currentRowOffset;
      let end = currentRowOffset + singleRow;
      currentRowOffset = end;

      if (isLast) end = row;

      const f = (ev: MessageEvent<WorkerResult | WorkerProgress>) => {
        const data = ev.data;
        if (data.type == "result") {
          const { pixels, iterations } = data;

          const pixelsResult = new Uint8ClampedArray(pixels);
          const iterationsResult = new Uint32Array(iterations);

          iterationTimeBuffer.set(iterationsResult, start * col);
          canvasArrayBuffer.set(pixelsResult, start * col * 4);
          progresses[idx] = 1.0;
          completed++;

          if (completed === WORKER_COUNT) {
            buffer.background(0);
            buffer.loadPixels();

            const pixels = buffer.pixels as unknown as Uint8ClampedArray;
            pixels.set(canvasArrayBuffer, 0);

            buffer.updatePixels();

            running = false;
            const after = performance.now();
            lastTime = (after - before).toFixed();
          }

          worker.removeEventListener("message", f);
        } else {
          const { progress } = data;
          progresses[idx] = progress;
          console.log(`worker[${idx}]: ${(progress * 100).toFixed(1)}`);
        }
      };

      worker.addEventListener("message", f);
      worker.addEventListener("error", () => {
        completed++;
      });

      const palette = colorsArray[currentColorIdx];
      const numberVars = {
        cx: currentParams.x.toString(),
        cy: currentParams.y.toString(),
        r: currentParams.r.toString(),
        N: vars.N,
      };
      worker.postMessage({ ...numberVars, row, col, R2, start, end, palette });
    });
  };
};

new p5(sketch);
