import "./style.css";
import p5 from "p5";
import { BigNumber } from "bignumber.js";
import { buildColors, recolor } from "./color";
import {
  MandelbrotParams,
  OffsetParams,
  WorkerProgress,
  WorkerResult,
} from "./types";
import {
  activeWorkerCount,
  currentWorkerType,
  registerWorkerTask,
  resetWorkers,
  terminateWorkers,
  toggleWorkerType,
  workersLength,
} from "./workers";
import { copyBufferRectToRect } from "./buffer";
import { divideRect } from "./rect";

const DEFAULT_N = 500;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;

const currentParams: MandelbrotParams = {
  x: new BigNumber("-1.40867236936669836954369923114776611328125"),
  y: new BigNumber("0.13573367440664611574869923114776611328125"),
  r: new BigNumber("0.00000363797880709171295166015625"),
  N: DEFAULT_N,
  R: 2,
};

const offsetParams: OffsetParams = {
  x: 0,
  y: 0,
};

resetWorkers();

let currentColorIdx = 0;

const zoom = (currentParams: MandelbrotParams, times: number) => {
  currentParams.r = currentParams.r.times(times);

  offsetParams.x = 0;
  offsetParams.y = 0;
};

const isSameParams = (a: MandelbrotParams, b: MandelbrotParams) =>
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
  p.rect(5, 5, p.width - 10, 80);
  p.rect(5, p.height - 25, p.width - 10, 22);
  p.fill(255);

  const pixelIdx = p.mouseX + p.mouseY * p.width;
  const iteration = iterationsBuffer[Math.floor(pixelIdx)];

  const ifInside = (val: { toString: () => String }) => {
    return isInside(p) ? val?.toString() : "-";
  };

  p.text(
    `centerX: ${currentParams.x}\nmouseX: ${ifInside(mouseX)}\ncenterY: ${
      currentParams.y
    }\nmouseY: ${ifInside(mouseY)}\nr: ${r.toPrecision(
      10
    )}, N: ${N}, iteration: ${ifInside(
      iteration
    )}, mode: ${currentWorkerType()}`,
    10,
    20
  );

  if (progress !== "100") {
    p.text(`Generating... ${progress}%`, 10, p.height - 10);
  } else {
    p.text(`Done! time: ${millis}ms`, 10, p.height - 10);
  }
};

const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

const sketch = (p: p5) => {
  let buffer: p5.Graphics;
  let lastCalc: MandelbrotParams = {
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
  let iterationTimeBufferTemp: Uint32Array;
  let running = false;
  let colorsArray: Uint8ClampedArray[];
  let completed = 0;
  const progresses = Array.from({ length: workersLength() }, () => 0);

  p.setup = () => {
    p.createCanvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    buffer = p.createGraphics(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    iterationTimeBuffer = new Uint32Array(buffer.height * buffer.width);
    iterationTimeBufferTemp = new Uint32Array(buffer.height * buffer.width);
    p.noStroke();
    p.colorMode(p.HSB, 360, 100, 100, 100);
    colorsArray = buildColors(p);
  };

  p.mouseClicked = () => {
    if (!isInside(p)) return;
    const { mouseX, mouseY } = calcVars(p);

    const pixelDiffX = Math.floor(p.mouseX - p.width / 2);
    const pixelDiffY = Math.floor(p.mouseY - p.height / 2);

    offsetParams.x = pixelDiffX;
    offsetParams.y = pixelDiffY;

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
          zoom(currentParams, 2);
        }
      } else {
        zoom(currentParams, 0.5);
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
      if (event.key === "r") {
        currentParams.r = new BigNumber("2.0");
      }
      if (event.key === "m") {
        toggleWorkerType();
        offsetParams.x = 0;
        offsetParams.y = 0;
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
      if (event.key === "ArrowDown") {
        if (currentParams.r.times(2).lt(5)) {
          zoom(currentParams, 2);
        }
      }
      if (event.key === "ArrowUp") {
        zoom(currentParams, 0.5);
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

    if (!shouldRedraw && isSameParams(lastCalc, currentParams)) {
      if (lastColorIdx !== currentColorIdx) {
        if (!colorsArray[currentColorIdx]) {
          currentColorIdx = 0;
        }
        lastColorIdx = currentColorIdx;
        recolor(
          p.width,
          p.height,
          buffer,
          currentParams.N,
          iterationTimeBuffer,
          colorsArray[currentColorIdx]
        );
      }

      p.background(0);
      p.image(buffer, 0, 0);
      drawInfo(
        p,
        vars,
        lastTime,
        (
          (progresses.reduce((p, c) => p + c) * 100) /
          activeWorkerCount()
        ).toFixed(),
        iterationTimeBuffer
      );
      return;
    }
    lastCalc = { ...currentParams };

    if (running) {
      terminateWorkers();
    }

    shouldRedraw = false;
    running = true;
    completed = 0;
    progresses.fill(0);
    const before = performance.now();

    const minSide = Math.sqrt((buffer.width * buffer.height) / workersLength());

    let calculationRects = divideRect(
      [{ x: 0, y: 0, width: buffer.width, height: buffer.height }],
      workersLength(),
      minSide
    );

    if (offsetParams.x !== 0 || offsetParams.y !== 0) {
      const offsetX = offsetParams.x;
      const offsetY = offsetParams.y;

      copyBufferRectToRect(
        iterationTimeBufferTemp,
        iterationTimeBuffer,
        buffer.width,
        buffer.width,
        buffer.width - Math.abs(offsetX),
        buffer.height - Math.abs(offsetY),
        Math.abs(Math.min(0, offsetX)),
        Math.abs(Math.min(0, offsetY)),
        Math.max(0, offsetX),
        Math.max(0, offsetY)
      );

      [iterationTimeBuffer, iterationTimeBufferTemp] = [
        iterationTimeBufferTemp,
        iterationTimeBuffer,
      ];

      const rects = [];
      if (offsetY !== 0) {
        // (1) 上下の横長矩形（offsetYが0なら存在しない）
        rects.push({
          x: 0,
          y: offsetY > 0 ? buffer.height - offsetY : 0,
          width: buffer.width,
          height: Math.abs(offsetY),
        });
      }
      if (offsetX !== 0) {
        // (2) 1に含まれる分を除いた左右の縦長矩形（offsetXが0なら存在しない）
        rects.push({
          x: offsetX > 0 ? buffer.width - offsetX : 0,
          y: offsetY > 0 ? 0 : Math.abs(offsetY),
          width: Math.abs(offsetX),
          height: buffer.height - Math.abs(offsetY),
        });
      }

      calculationRects = divideRect(rects, workersLength(), minSide);
    }

    registerWorkerTask(
      calculationRects,
      (worker, rect, idx, workers, isCompleted) => {
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
              buffer.width,
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
              recolor(
                p.width,
                p.height,
                buffer,
                currentParams.N,
                iterationTimeBuffer,
                colorsArray[currentColorIdx]
              );

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

        const palette = colorsArray[currentColorIdx];
        const numberVars = {
          cx: currentParams.x.toString(),
          cy: currentParams.y.toString(),
          r: currentParams.r.toString(),
          N: vars.N,
        };
        worker.postMessage({
          ...numberVars,
          row,
          col,
          R2,
          startY,
          endY,
          startX,
          endX,
          palette,
        });
      }
    );
  };
};

const p5root = document.getElementById("p5root");
new p5(sketch, p5root!);
