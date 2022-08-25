import "./style.css";
import p5 from "p5";

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
  x: number;
  y: number;
  r: number;
  N: number;
  R: number;
}

const DEFAULT_N = 500;
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 900;
const WORKER_COUNT = 32;

const currentParams: MandelBrotParams = {
  x: -1.26222,
  y: -0.04592,
  r: 0.01,
  N: DEFAULT_N,
  R: 2,
};

const workers: Worker[] = [];

const resetWorker = () => {
  workers.splice(0);

  for (let i = 0; i < WORKER_COUNT; i++) {
    const path = new URL("./worker.ts", import.meta.url);
    workers.push(new Worker(path, { type: "module" }));
  }
};

resetWorker();

let currentColorIdx = 0;

const isSameParams = (a: MandelBrotParams, b: MandelBrotParams) =>
  a.x === b.x && a.y === b.y && a.r === b.r && a.N === b.N && a.R === b.R;

const calcVars = (p: p5) => {
  const xmin =
    currentParams.x - currentParams.r * ((p.width - 1) / (p.height - 1));
  const ymax = currentParams.y + currentParams.r;
  const dpp = (2 * currentParams.r) / (p.height - 1);
  const mouseX = xmin + dpp * p.mouseX;
  const mouseY = ymax - dpp * p.mouseY;
  const r = currentParams.r;
  const N = currentParams.N;

  return {
    xmin,
    ymax,
    dpp,
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
  p.rect(5, 5, DEFAULT_WIDTH - 10, 22);
  p.rect(5, DEFAULT_HEIGHT - 25, DEFAULT_WIDTH - 10, 22);
  p.fill(255);

  const pixelIdx = p.mouseX + p.mouseY * p.width;

  const iteration = iterationsBuffer[Math.floor(pixelIdx)];
  p.text(
    `X: ${mouseX}, Y: ${mouseY}, r: ${r}, N: ${N}, iteration: ${iteration}`,
    10,
    20
  );

  if (progress !== "100") {
    p.text(`Generating... ${progress}%`, 10, DEFAULT_HEIGHT - 10);
  } else {
    p.text(`Done! time: ${millis}ms`, 10, DEFAULT_HEIGHT - 10);
  }
};

const posterize = (
  p: p5,
  value: number,
  numberOfTones: number,
  lower: number,
  upper: number
) => {
  const paletteLength = numberOfTones * 2;
  const v = value % paletteLength;

  if (v < numberOfTones) {
    return p.map(Math.floor(v % numberOfTones), 0, numberOfTones, lower, upper);
  } else {
    return p.map(Math.floor(v % numberOfTones), 0, numberOfTones, upper, lower);
  }
};

type ColorMapper = {
  size: number;
  f: (p: p5, n: number, offset?: number) => p5.Color;
};

const colors: ColorMapper[] = [
  {
    size: 256,
    f: (p, n) => {
      // hue 0~360
      const hue = posterize(p, n, 128, 0, 360);
      return p.color(hue, 75, 100);
    },
  },
  {
    size: 256,
    f: (p, n) => {
      // monochrome
      const brightness = posterize(p, n, 128, 20, 100);
      return p.color(0, 0, brightness);
    },
  },
  {
    size: 256,
    f: (p, n) => {
      // fire
      const brightness = posterize(p, n, 128, 30, 100);
      return p.color(0, 90, brightness);
    },
  },
];

const buildColors = (p: p5) => {
  const result: Uint8ClampedArray[] = [];

  colors.forEach((colorMapper) => {
    const array = new Uint8ClampedArray(colorMapper.size * 4);

    for (let i = 0; i < colorMapper.size; i++) {
      const color = colorMapper.f(p, i);
      const idx = i * 4;
      array[idx + 0] = p.red(color);
      array[idx + 1] = p.green(color);
      array[idx + 2] = p.blue(color);
      array[idx + 3] = 255;
    }

    result.push(array);
  });

  return result;
};

const sketch = (p: p5) => {
  let buffer: p5.Graphics;
  let lastCalc: MandelBrotParams = { x: 0, y: 0, r: 0, N: 0, R: 0 };
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
    const { mouseX, mouseY } = calcVars(p);

    currentParams.x = mouseX;
    currentParams.y = mouseY;
  };

  p.mouseWheel = (event: { deltaY: number }) => {
    const { mouseX, mouseY } = calcVars(p);

    if (p.keyIsDown(p.SHIFT)) {
      currentParams.x = mouseX;
      currentParams.y = mouseY;
    }

    if (event) {
      if (event.deltaY > 0) {
        if (currentParams.r * 2 < 5) {
          currentParams.r *= 2;
        }
      } else {
        currentParams.r *= 0.5;
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
      resetWorker();
    }

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
        }
      };

      worker.addEventListener("message", f);
      worker.addEventListener("error", () => {
        completed++;
      });

      const palette = colorsArray[currentColorIdx];
      worker.postMessage({ ...vars, row, col, R2, start, end, palette });
    });
  };
};

new p5(sketch);
