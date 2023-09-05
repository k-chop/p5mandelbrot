import BigNumber from "bignumber.js";
import p5 from "p5";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { getIterationTimeAt } from "./aggregator";
import {
  addPalettes,
  clearResultBuffer,
  mergeToMainBuffer,
  nextBuffer,
  nextResultBuffer,
  renderToResultBuffer,
  setColorIndex,
  setupCamera,
} from "./camera";
import { setP5 } from "./canvas-reference";
import { chromaJsPalettes } from "./color/color-chromajs";
import { p5jsPalettes } from "./color/color-p5js";
import {
  calcVars,
  cycleMode,
  getCanvasSize,
  getCurrentParams,
  getPreviousRenderTime,
  getProgressString,
  paramsChanged,
  resetIterationCount,
  resetRadius,
  setCurrentParams,
  setDeepIterationCount,
  setOffsetParams,
  togglePinReference,
  startCalculation,
  zoom,
} from "./mandelbrot";
import { Rect } from "./rect";
import { drawCrossHair } from "./rendering";
import { createStore, getStore, updateStore } from "./store/store";
import { readPOIListFromStorage } from "./store/sync-storage/poi-list";
import {
  isSettingField,
  readSettingsFromStorage,
} from "./store/sync-storage/settings";
import "./style.css";
import { AppRoot } from "./view/app-root";
import { currentWorkerType, resetWorkers, setWorkerCount } from "./workers";
import { extractMandelbrotParams } from "./lib/params";
import { d3ChromaticPalettes } from "./color/color-d3-chromatic";

resetWorkers();

createStore({
  // mandelbrot params
  centerX: new BigNumber(0),
  centerY: new BigNumber(0),
  mouseX: new BigNumber(0),
  mouseY: new BigNumber(0),
  r: new BigNumber(0),
  N: 0,
  iteration: 0,
  mode: "normal",
  // POI List
  poi: [],
  // Settings
  zoomRate: 2.0,
  workerCount: 2,
  // UI state
  canvasLocked: false,
  // mandelbrot state
  isReferencePinned: false,
});

// localStorageから復帰
const hydratedPOIList = readPOIListFromStorage();
updateStore("poi", hydratedPOIList);

const hydratedSettings = readSettingsFromStorage();
Object.keys(hydratedSettings).forEach((key) => {
  if (isSettingField(key)) {
    updateStore(key, hydratedSettings[key]);
  }
});
updateStore("zoomRate", hydratedSettings.zoomRate);

// hydrateしたworkerCountの値でworkerを初期化する
setWorkerCount();

// ----------------------------------------

const drawInfo = (p: p5) => {
  const { mouseX, mouseY, r, N } = calcVars(
    p.mouseX,
    p.mouseY,
    p.width,
    p.height,
  );

  const iteration = getIterationTimeAt(p.mouseX, p.mouseY);

  const ifInside = (val: { toString: () => String }) => {
    return isInside(p) ? val?.toString() : "-";
  };

  const params = getCurrentParams();
  const progress = getProgressString();
  const millis = getPreviousRenderTime();

  updateStore("centerX", params.x);
  updateStore("centerY", params.y);
  updateStore("mouseX", mouseX);
  updateStore("mouseY", mouseY);
  updateStore("r", r);
  updateStore("N", N);
  if (iteration !== -1) {
    updateStore("iteration", ifInside(iteration));
  }
  updateStore("mode", currentWorkerType());

  updateStore("progress", progress);
  updateStore("millis", millis);
};

let currentCursor: "cross" | "grab" = "cross";
let mouseDragged = false;
let mouseClickedOn = { mouseX: 0, mouseY: 0 };
let mouseReleasedOn = { mouseX: 0, mouseY: 0 };
let mouseDraggedComplete = false;

const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

const changeCursor = (p: p5, cursor: string) => {
  if (currentCursor === cursor) return;
  if (isInside(p)) {
    p.cursor(cursor);
  }
};

const getDraggingPixelDiff = (p: p5) => {
  const { mouseX: clickedMouseX, mouseY: clickedMouseY } = mouseClickedOn;

  const pixelDiffX = Math.floor(p.mouseX - clickedMouseX);
  const pixelDiffY = Math.floor(p.mouseY - clickedMouseY);

  return { pixelDiffX, pixelDiffY };
};

const sketch = (p: p5) => {
  let mouseClickStartedInside = false;

  p.setup = () => {
    const { width, height } = getCanvasSize();

    addPalettes(...d3ChromaticPalettes);
    addPalettes(...p5jsPalettes(p));
    addPalettes(...chromaJsPalettes);

    p.createCanvas(width, height);
    setupCamera(p, width, height);

    p.colorMode(p.HSB, 360, 100, 100, 100);

    p.cursor(p.CROSS);

    setP5(p);

    const initialParams = extractMandelbrotParams();

    if (initialParams) {
      setCurrentParams(initialParams);
    }
  };

  p.mousePressed = () => {
    if (isInside(p)) {
      if (getStore("canvasLocked")) return;

      mergeToMainBuffer();

      mouseClickStartedInside = true;
      mouseDragged = false;
      mouseClickedOn = { mouseX: p.mouseX, mouseY: p.mouseY };
    }
  };

  p.mouseDragged = (ev: MouseEvent) => {
    if (mouseClickStartedInside) {
      ev.preventDefault();

      changeCursor(p, "grabbing");
      mouseDragged = true;
      clearResultBuffer();
    }
  };

  p.mouseReleased = (ev: MouseEvent) => {
    if (!ev) return;
    if (ev.button !== 0) return;

    // canvas内でクリックして、canvas内で離した場合のみクリック時の処理を行う
    // これで外からcanvas内に流れてきた場合の誤クリックを防げる

    if (mouseClickStartedInside) {
      if (getStore("canvasLocked")) return;

      ev.preventDefault();

      if (mouseDragged) {
        // ドラッグ終了時
        const { pixelDiffX, pixelDiffY } = getDraggingPixelDiff(p);
        setOffsetParams({ x: -pixelDiffX, y: -pixelDiffY });
        mouseReleasedOn = { mouseX: pixelDiffX, mouseY: pixelDiffY };

        const centerX = p.width / 2;
        const centerY = p.height / 2;

        const { mouseX, mouseY } = calcVars(
          centerX - pixelDiffX,
          centerY - pixelDiffY,
          p.width,
          p.height,
        );

        setCurrentParams({ x: mouseX, y: mouseY });

        mouseDraggedComplete = true;
      } else {
        // クリック時
        const { mouseX, mouseY } = calcVars(
          p.mouseX,
          p.mouseY,
          p.width,
          p.height,
        );

        setCurrentParams({ x: mouseX, y: mouseY });

        const rate = getStore("zoomRate");
        // shiftキーを押しながらクリックすると縮小
        if (ev.shiftKey) {
          zoom(rate);
        } else {
          zoom(1.0 / rate);
        }
      }
    }

    changeCursor(p, p.CROSS);
    mouseClickStartedInside = false;
    mouseDragged = false;
  };

  p.mouseWheel = (event: WheelEvent) => {
    if (!isInside(p)) return;
    if (getStore("canvasLocked")) return;

    // canvas内ではスクロールしないようにする
    event.preventDefault();

    const { mouseX, mouseY } = calcVars(p.mouseX, p.mouseY, p.width, p.height);

    if (p.keyIsDown(p.SHIFT)) {
      setCurrentParams({ x: mouseX, y: mouseY });
    }

    if (event) {
      const rate = getStore("zoomRate");
      if (event.deltaY > 0) {
        zoom(rate);
      } else {
        zoom(1.0 / rate);
      }
    }
  };

  p.keyPressed = (event: KeyboardEvent | undefined) => {
    if (getStore("canvasLocked")) return;

    if (event) {
      let diff = 100;
      const params = getCurrentParams();
      const rate = getStore("zoomRate");

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
      if (event.key === "6") setColorIndex(5);
      if (event.key === "7") setColorIndex(6);
      if (event.key === "8") setColorIndex(7);
      if (event.key === "0") resetIterationCount();
      if (event.key === "9") setDeepIterationCount();
      if (event.key === "r") resetRadius();
      if (event.key === "m") cycleMode();
      if (event.key === "ArrowDown") zoom(rate);
      if (event.key === "s") zoom(rate);
      if (event.key === "p") togglePinReference();
      if (event.key === "ArrowUp") zoom(1.0 / rate);
      if (event.key === "w") zoom(1.0 / rate);
      if (event.key === "ArrowRight") setCurrentParams({ N: params.N + diff });
      if (event.key === "ArrowLeft") setCurrentParams({ N: params.N - diff });

      event.preventDefault();
    }
  };

  p.draw = () => {
    const mainBuffer = nextBuffer(p);
    const resultBuffer = nextResultBuffer(p);

    p.background(0);

    if (mouseDragged) {
      const { pixelDiffX, pixelDiffY } = getDraggingPixelDiff(p);
      p.image(mainBuffer, pixelDiffX, pixelDiffY);
      drawCrossHair(p);
    } else if (mouseDraggedComplete) {
      const { mouseX, mouseY } = mouseReleasedOn;
      p.image(mainBuffer, mouseX, mouseY);
    } else {
      p.image(mainBuffer, 0, 0);
    }

    p.image(resultBuffer, 0, 0);

    drawInfo(p);

    if (paramsChanged()) {
      startCalculation((updatedRect: Rect, isCompleted: boolean) => {
        renderToResultBuffer(updatedRect);

        if (isCompleted) {
          mouseDraggedComplete = false;
          mergeToMainBuffer();
        }
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
  </React.StrictMode>,
);
