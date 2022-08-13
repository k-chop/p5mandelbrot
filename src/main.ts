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

const currentParams: MandelBrotParams = {
  x: -1.26222,
  y: -0.04592,
  r: 0.01,
  N: DEFAULT_N,
  R: 2,
};

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
  return p.map(
    Math.floor(value % numberOfTones),
    0,
    numberOfTones,
    lower,
    upper
  );
};

type ColorMapper = (p: p5, n: number) => p5.Color;

const colors: ColorMapper[] = [
  (p, n) => {
    // hue 0~360
    const hue = posterize(p, n, 64, 0, 360);
    return p.color(hue, 75, 100);
  },
  (p, n) => {
    // monochrome
    const brightness = posterize(p, n, 20, 20, 100);
    return p.color(0, 0, brightness);
  },
  (p, n) => {
    // fire
    const brightness = posterize(p, n, 32, 30, 100);
    return p.color(0, 90, brightness);
  },
];

const mappedColor = (p: p5, n: number) => {
  return colors[currentColorIdx % colors.length](p, n);
};

const sketch = (p: p5) => {
  let buffer: p5.Graphics;
  let lastCalc: MandelBrotParams = { x: 0, y: 0, r: 0, N: 0, R: 0 };
  let lastColorIdx = 0;
  let lastTime = "0";

  p.setup = () => {
    p.createCanvas(1600, 900);
    buffer = p.createGraphics(1600, 900);
    p.pixelDensity(1);
    p.frameRate(30);

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

      if (event.shiftKey) diff *= 10;
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
    const { xmin, ymax, dpp, N } = vars;
    const R2 = currentParams.R * currentParams.R;

    if (
      isSameParams(lastCalc, currentParams) &&
      currentColorIdx === lastColorIdx
    ) {
      p.image(buffer, 0, 0);
      drawInfo(p, vars, lastTime);
      return;
    }
    lastCalc = { ...currentParams };
    lastColorIdx = currentColorIdx;

    const before = performance.now();

    buffer.background(0);

    buffer.loadPixels();

    for (let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        let zr = 0.0;
        let zi = 0.0;
        const cr = xmin + dpp * j;
        const ci = ymax - dpp * i;

        let n = 0;
        while (n < N) {
          const tr = zr * zr - zi * zi + cr;
          const ti = zr * zi * 2 + ci;
          zr = tr;
          zi = ti;

          const absz = zr * zr + zi * zi;
          if (absz > R2) {
            break;
          }
          n++;
        }

        const pixelIndex = (j + i * p.width) * 4;
        const hsb = mappedColor(p, n);
        if (n != N) {
          buffer.pixels[pixelIndex + 0] = p.red(hsb);
          buffer.pixels[pixelIndex + 1] = p.green(hsb);
          buffer.pixels[pixelIndex + 2] = p.blue(hsb);
          buffer.pixels[pixelIndex + 3] = 255;
        }
      }
    }
    buffer.updatePixels();

    p.image(buffer, 0, 0);

    const after = performance.now();
    lastTime = (after - before).toFixed();
    drawInfo(p, vars, lastTime);
  };
};

new p5(sketch);
