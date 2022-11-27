import "./style.css";
import p5 from "p5";
import { buildColors, recolor } from "./color";
import { currentWorkerType, resetWorkers } from "./workers";
import {
  calcVars,
  changeMode,
  exportParamsToClipboard,
  getCanvasSize,
  getCurrentParams,
  getIterationTimeAt,
  getIterationTimes,
  getPalette,
  getPreviousRenderTime,
  getProgressString,
  importParamsFromClipboard,
  resetIterationCount,
  resetRadius,
  setColorIndex,
  setColorsArray,
  setCurrentParams,
  setDeepIterationCount,
  setOffsetParams,
  shouldDrawWithoutRecolor,
  shouldDrawColorChanged,
  shouldDrawCompletedArea,
  updateColor,
  zoom,
  startCalculation,
  initializeBuffer,
} from "./mandelbrot";

resetWorkers();

const drawInfo = (p: p5) => {
  const { mouseX, mouseY, r, N } = calcVars(
    p.mouseX,
    p.mouseY,
    p.width,
    p.height
  );

  p.fill(0, 35);
  p.rect(5, 5, p.width - 10, 80);
  p.rect(5, p.height - 25, p.width - 10, 22);
  p.fill(255);

  const iteration = getIterationTimeAt(p.mouseX, p.mouseY);

  const ifInside = (val: { toString: () => String }) => {
    return isInside(p) ? val?.toString() : "-";
  };

  const params = getCurrentParams();
  const progress = getProgressString();
  const millis = getPreviousRenderTime();

  p.text(
    `centerX: ${params.x}\nmouseX: ${ifInside(mouseX)}\ncenterY: ${
      params.y
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

  p.setup = () => {
    const { width, height } = getCanvasSize();

    p.createCanvas(width, height);
    buffer = p.createGraphics(width, height);

    p.noStroke();
    p.colorMode(p.HSB, 360, 100, 100, 100);

    initializeBuffer();

    setColorsArray(buildColors(p));
  };

  p.mouseClicked = () => {
    if (!isInside(p)) return;

    const { mouseX, mouseY } = calcVars(p.mouseX, p.mouseY, p.width, p.height);

    const pixelDiffX = Math.floor(p.mouseX - p.width / 2);
    const pixelDiffY = Math.floor(p.mouseY - p.height / 2);

    setOffsetParams({ x: pixelDiffX, y: pixelDiffY });
    setCurrentParams({ x: mouseX, y: mouseY });
  };

  p.mouseWheel = (event: { deltaY: number }) => {
    if (!isInside(p)) return;

    const { mouseX, mouseY } = calcVars(p.mouseX, p.mouseY, p.width, p.height);

    if (p.keyIsDown(p.SHIFT)) {
      setCurrentParams({ x: mouseX, y: mouseY });
    }

    if (event) {
      if (event.deltaY > 0) {
        zoom(2);
      } else {
        zoom(0.5);
      }
    }
  };

  p.keyPressed = (event: KeyboardEvent | undefined) => {
    if (event) {
      let diff = 100;
      const params = getCurrentParams();

      if (event.shiftKey) {
        const N = params.N;
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
      if (event.key === "1") setColorIndex(0);
      if (event.key === "2") setColorIndex(1);
      if (event.key === "3") setColorIndex(2);
      if (event.key === "4") setColorIndex(3);
      if (event.key === "5") setColorIndex(4);
      if (event.key === "0") resetIterationCount();
      if (event.key === "9") setDeepIterationCount();
      if (event.key === "r") resetRadius();
      if (event.key === "m") changeMode();
      if (event.key === "o") exportParamsToClipboard();
      if (event.key === "i") importParamsFromClipboard();
      if (event.key === "ArrowDown") zoom(2);
      if (event.key === "ArrowUp") zoom(0.5);
      if (event.key === "ArrowRight") setCurrentParams({ N: params.N + diff });
      if (event.key === "ArrowLeft") setCurrentParams({ N: params.N - diff });
    }
  };

  p.draw = () => {
    const params = getCurrentParams();

    if (shouldDrawCompletedArea() || shouldDrawColorChanged()) {
      updateColor();

      recolor(
        p.width,
        p.height,
        buffer,
        params.N,
        getIterationTimes(),
        getPalette()
      );

      p.background(0);
      p.image(buffer, 0, 0);
      drawInfo(p);

      return;
    } else if (shouldDrawWithoutRecolor()) {
      p.background(0);
      p.image(buffer, 0, 0);
      drawInfo(p);

      return;
    }

    startCalculation(() => {
      recolor(
        p.width,
        p.height,
        buffer,
        params.N,
        getIterationTimes(),
        getPalette()
      );
    });
  };
};

const p5root = document.getElementById("p5root");
new p5(sketch, p5root!);
