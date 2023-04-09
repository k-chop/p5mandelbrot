import "./style.css";
import p5 from "p5";
import { buildColors } from "./color";
import { currentWorkerType, resetWorkers } from "./workers";
import {
  calcVars,
  changeMode,
  exportParamsToClipboard,
  getCanvasSize,
  getCurrentParams,
  getPreviousRenderTime,
  getProgressString,
  importParamsFromClipboard,
  resetIterationCount,
  resetRadius,
  setCurrentParams,
  setDeepIterationCount,
  setOffsetParams,
  paramsChanged,
  zoom,
  startCalculation,
} from "./mandelbrot";
import {
  nextBuffer,
  renderToMainBuffer,
  setColorIndex,
  setColorsArray,
  setupCamera,
} from "./camera";
import { Rect } from "./rect";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { AppRoot } from "./view/app-root";
import { createStore, updateStore } from "./store/store";
import { getIterationTimeAt } from "./aggregator";

resetWorkers();

createStore({
  centerX: "",
  centerY: "",
  mouseX: "",
  mouseY: "",
  r: "",
  N: 0,
  iteration: 0,
  mode: "",
});

const drawInfo = (p: p5) => {
  const { mouseX, mouseY, r, N } = calcVars(
    p.mouseX,
    p.mouseY,
    p.width,
    p.height
  );

  const iteration = getIterationTimeAt(p.mouseX, p.mouseY);

  const ifInside = (val: { toString: () => String }) => {
    return isInside(p) ? val?.toString() : "-";
  };

  const params = getCurrentParams();
  const progress = getProgressString();
  const millis = getPreviousRenderTime();

  // TODO: たぶんrの値見て精度を決めるべき
  updateStore("centerX", params.x.toPrecision(20));
  updateStore("centerY", params.y.toPrecision(20));
  updateStore("mouseX", mouseX.toPrecision(20));
  updateStore("mouseY", mouseY.toPrecision(20));
  updateStore("r", r.toPrecision(10));
  updateStore("N", N);
  if (iteration !== -1) {
    updateStore("iteration", ifInside(iteration));
  }
  updateStore("mode", currentWorkerType());

  updateStore("progress", progress);
  updateStore("millis", millis);
};

const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

const sketch = (p: p5) => {
  p.setup = () => {
    const { width, height } = getCanvasSize();

    p.createCanvas(width, height);
    setupCamera(p, width, height);

    p.noStroke();
    p.colorMode(p.HSB, 360, 100, 100, 100);

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

  p.mouseWheel = (event: WheelEvent) => {
    if (!isInside(p)) return;

    // canvas内ではスクロールしないようにする
    event.preventDefault();

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

      event.preventDefault();
    }
  };

  p.draw = () => {
    const result = nextBuffer(p);
    p.background(0);
    p.image(result, 0, 0);
    drawInfo(p);

    if (paramsChanged()) {
      startCalculation((updatedRect: Rect) => {
        renderToMainBuffer(updatedRect);
      });
    }
  };
};

const p5root = document.getElementById("p5root");
new p5(sketch, p5root!);

// Canvas以外の要素
const container = document.getElementById("app-root")!;
ReactDOMClient.createRoot(container).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
