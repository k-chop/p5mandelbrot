import "./style.css";
import p5 from "p5";

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

const drawInfo = (p: p5, vars: ReturnType<typeof calcVars>, millis: string) => {
  const { mouseX, mouseY, r, N } = vars;
  p.fill(255);
  p.text(
    `X: ${mouseX}, Y: ${mouseY}, r: ${r}, N: ${N}, time: ${millis}ms`,
    10,
    25
  );
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

const draw = (
  p: p5,
  buffer: p5.Graphics,
  pixelIndex: number,
  iterationTime: number,
  offset?: number
) => {
  const hsb = mappedColor(p, iterationTime, offset);

  if (iterationTime != currentParams.N) {
    buffer.pixels[pixelIndex + 0] = p.red(hsb);
    buffer.pixels[pixelIndex + 1] = p.green(hsb);
    buffer.pixels[pixelIndex + 2] = p.blue(hsb);
    buffer.pixels[pixelIndex + 3] = 255;
  }
};

const drawAll = (
  p: p5,
  buffer: p5.Graphics,
  iterationTimeBuffer: Uint32Array
) => {
  buffer.background(0);
  buffer.loadPixels();

  for (let i = 0; i < buffer.height; i++) {
    for (let j = 0; j < buffer.width; j++) {
      const n = iterationTimeBuffer[j + i * buffer.width];
      const pixelIndex = (j + i * buffer.width) * 4;
      draw(p, buffer, pixelIndex, n, p.frameCount);
    }
  }
  buffer.updatePixels();
};

const launchMandelbrotCalculatorWorkers = () => {};

type ColorMapper = (p: p5, n: number, offset?: number) => p5.Color;

const colors: ColorMapper[] = [
  (p, n, offset = 0) => {
    // hue 0~360
    const hue = posterize(p, n + offset, 128, 0, 360);
    return p.color(hue, 75, 100);
  },
  (p, n, offset = 0) => {
    // monochrome
    const brightness = posterize(p, n + offset, 128, 20, 100);
    return p.color(0, 0, brightness);
  },
  (p, n, offset = 0) => {
    // fire
    const brightness = posterize(p, n + offset, 128, 30, 100);
    return p.color(0, 90, brightness);
  },
];

const mappedColor = (p: p5, n: number, offset = 0) => {
  return colors[currentColorIdx % colors.length](p, n, offset);
};

const sketch = (p: p5) => {
  let buffer: p5.Graphics;
  let lastCalc: MandelBrotParams = { x: 0, y: 0, r: 0, N: 0, R: 0 };
  let lastColorIdx = 0;
  let lastTime = "0";
  let iterationTimeBuffer: Uint32Array;
  let running = false;

  p.setup = () => {
    p.createCanvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    buffer = p.createGraphics(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    p.pixelDensity(1);
    iterationTimeBuffer = new Uint32Array(buffer.height * buffer.width);

    p.colorMode(p.HSB, 360, 100, 100, 100);
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
        currentParams.r *= 2;
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
      drawInfo(p, vars, lastTime);
      return;
    }
    lastCalc = { ...currentParams };
    lastColorIdx = currentColorIdx;

    if (running) {
      workers.forEach((worker) => worker.terminate());
      resetWorker();
    }

    running = true;
    const before = performance.now();

    buffer.background(0);
    buffer.loadPixels();

    const singleRow = Math.floor(row / workers.length);
    let currentRowOffset = 0;
    let completed = 0;
    workers.forEach((worker, idx) => {
      const isLast = idx === workers.length - 1;
      const start = currentRowOffset;
      let end = currentRowOffset + singleRow;
      currentRowOffset = end;

      if (isLast) end = row;

      const f = (ev: MessageEvent<ArrayBuffer>) => {
        const result = new Uint8ClampedArray(ev.data);
        const pixels = buffer.pixels as unknown as Uint8ClampedArray;

        pixels.set(result, start * col * 4);
        completed++;

        if (completed === WORKER_COUNT) {
          buffer.updatePixels();

          running = false;
          const after = performance.now();
          lastTime = (after - before).toFixed();
        }
      };

      worker.addEventListener("message", f, { once: true });
      worker.addEventListener("error", () => {
        completed++;
      });

      worker.postMessage({ ...vars, row, col, R2, start, end });
    });
  };
};

new p5(sketch);
