import "./style.css";
import p5 from "p5";

interface MandelBrotParams {
  x: number;
  y: number;
  r: number;
  N: number;
  R: number;
}

const currentParams: MandelBrotParams = {
  x: -1.26222,
  y: -0.04592,
  r: 0.01,
  N: 500,
  R: 2,
};

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

const drawInfo = (p: p5, vars: ReturnType<typeof calcVars>) => {
  const { mouseX, mouseY, r, N } = vars;
  p.fill(255);
  p.text(`X: ${mouseX}, Y: ${mouseY}, r: ${r}, N: ${N}`, 10, 25);
};

const sketch = (p: p5) => {
  let buffer: p5.Graphics;
  let lastCalc: MandelBrotParams = { x: 0, y: 0, r: 0, N: 0, R: 0 };

  p.setup = () => {
    p.createCanvas(1600, 900);
    buffer = p.createGraphics(1600, 900);
    p.pixelDensity(1);
    p.frameRate(30);
  };

  p.mouseClicked = () => {
    const { mouseX, mouseY } = calcVars(p);

    currentParams.x = mouseX;
    currentParams.y = mouseY;
  };

  p.mouseWheel = (event: { deltaY: number }) => {
    const { mouseX, mouseY } = calcVars(p);

    currentParams.x = mouseX;
    currentParams.y = mouseY;

    if (event) {
      if (event.deltaY > 0) {
        currentParams.r *= 2;
      } else {
        currentParams.r *= 0.5;
      }
    }
  };

  p.keyPressed = (event: { keyCode: number } | undefined) => {
    if (event) {
      if (event.keyCode === p.RIGHT_ARROW) currentParams.N += 100;
      if (event.keyCode === p.LEFT_ARROW) currentParams.N -= 100;
    }
  };

  p.draw = () => {
    const row = buffer.height;
    const col = buffer.width;

    const vars = calcVars(p);
    const { xmin, ymax, dpp, N } = vars;
    const R2 = currentParams.R * currentParams.R;

    if (isSameParams(lastCalc, currentParams)) {
      p.image(buffer, 0, 0);
      drawInfo(p, vars);
      return;
    }
    lastCalc = { ...currentParams };

    buffer.background(0);

    buffer.loadPixels();

    for (let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        let zr = 0.0;
        let zi = 0.0;
        const cr = xmin + dpp * j;
        const ci = ymax - dpp * i;

        let k = 0;
        while (k < N) {
          const tzr = zr * zr - zi * zi + cr;
          zi = zr * zi * 2 + ci;
          zr = tzr;

          const absz = zr * zr + zi * zi;
          if (absz > R2) {
            break;
          }
          k++;
        }

        const pixelIndex = (j + i * p.width) * 4;
        let bright = k % 255;
        if (k == N) {
          bright = 0;
        } else {
          buffer.pixels[pixelIndex + 0] = bright;
          buffer.pixels[pixelIndex + 1] = bright;
          buffer.pixels[pixelIndex + 2] = bright;
          buffer.pixels[pixelIndex + 3] = 255;
        }
      }
    }
    buffer.updatePixels();

    p.image(buffer, 0, 0);
    drawInfo(p, vars);
  };
};

new p5(sketch);
