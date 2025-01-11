import { nextBuffer, setupCamera } from "@/camera/camera";
import {
  changePaletteFromPresets,
  cycleCurrentPaletteOffset,
  setPalette,
} from "@/camera/palette";
import p5 from "p5";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { getIterationTimeAt } from "./aggregator";
import { setP5 } from "./canvas-reference";
import { extractMandelbrotParams } from "./lib/params";
import {
  calcVars,
  cycleMode,
  getCanvasSize,
  getCurrentParams,
  paramsChanged,
  resetIterationCount,
  resetRadius,
  setCurrentParams,
  setDeepIterationCount,
  setOffsetParams,
  startCalculation,
  togglePinReference,
  zoom,
} from "./mandelbrot";
import {
  addCurrentLocationToPOIHistory,
  initializePOIHistory,
} from "./poi-history/poi-history";
import { drawCrossHair } from "./rendering";
import { createStore, getStore, updateStore } from "./store/store";
import { readPOIListFromStorage } from "./store/sync-storage/poi-list";
import {
  isSettingField,
  readSettingsFromStorage,
} from "./store/sync-storage/settings";
import "./style.css";
import { AppRoot } from "./view/app-root";
import { prepareWorkerPool } from "./worker-pool/pool-instance";
import { getProgressData } from "./worker-pool/worker-pool";

const drawInfo = (p: p5) => {
  const { mouseX, mouseY, r, N } = calcVars(
    p.mouseX,
    p.mouseY,
    p.width,
    p.height,
  );

  const iteration = getIterationTimeAt(p.mouseX, p.mouseY);

  const ifInside = (val: { toString: () => string }) => {
    return isInside(p) ? val?.toString() : "-";
  };

  const params = getCurrentParams();
  const progress = getProgressData();

  updateStore("centerX", params.x);
  updateStore("centerY", params.y);
  updateStore("mouseX", mouseX);
  updateStore("mouseY", mouseY);
  updateStore("r", r);
  updateStore("N", N);
  if (iteration !== -1) {
    updateStore("iteration", ifInside(iteration));
  }

  updateStore("progress", progress);
};

const currentCursor: "cross" | "grab" = "cross";
let mouseDragged = false;
let mouseClickedOn = { mouseX: 0, mouseY: 0 };
let shouldSavePOIHistoryNextRender = false;
/** mainBufferの表示位置を0,0から変えているかどうか  */
let isTranslatingMainBuffer = false;
/** どのドラッグ操作をしているか */
let draggingMode: "move" | "zoom" | undefined = undefined;

let elapsed = 0;

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

    const canvas = p.createCanvas(width, height);
    // canvas上での右クリックを無効化
    canvas.elt.addEventListener("contextmenu", (e: Event) =>
      e.preventDefault(),
    );
    setupCamera(p, width, height);

    p.colorMode(p.HSB, 360, 100, 100, 100);

    p.cursor(p.CROSS);

    setP5(p);

    initializePOIHistory();

    const initialParams = extractMandelbrotParams();

    if (initialParams) {
      setCurrentParams(initialParams.mandelbrot);
      setPalette(initialParams.palette);
    }
  };

  p.mousePressed = () => {
    if (isInside(p)) {
      if (getStore("canvasLocked")) return;

      mouseClickStartedInside = true;
      mouseDragged = false;
      mouseClickedOn = { mouseX: p.mouseX, mouseY: p.mouseY };
    }
  };

  p.mouseDragged = (ev: MouseEvent) => {
    if (mouseClickStartedInside) {
      ev.preventDefault();

      if (ev.buttons === 1) {
        // RMB
        draggingMode = "move";
        changeCursor(p, "grabbing");
      } else if (ev.buttons === 2) {
        // LMB
        draggingMode = "zoom";
        changeCursor(p, "zoom-in"); // FIXME: あとで始点からどっちにいるかどうかでアイコン変える
      }

      mouseDragged = true;
      isTranslatingMainBuffer = true;
    }
  };

  p.mouseReleased = (ev: MouseEvent) => {
    if (!ev) return;

    // canvas内でクリックして、canvas内で離した場合のみクリック時の処理を行う
    // これで外からcanvas内に流れてきた場合の誤クリックを防げる

    if (mouseClickStartedInside) {
      if (getStore("canvasLocked")) return;

      ev.preventDefault();

      if (mouseDragged) {
        // ドラッグ終了時
        const { pixelDiffX, pixelDiffY } = getDraggingPixelDiff(p);
        setOffsetParams({ x: -pixelDiffX, y: -pixelDiffY });

        const centerX = p.width / 2;
        const centerY = p.height / 2;

        const { mouseX, mouseY } = calcVars(
          centerX - pixelDiffX,
          centerY - pixelDiffY,
          p.width,
          p.height,
        );

        setCurrentParams({ x: mouseX, y: mouseY });
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
      if (event.key === "1") changePaletteFromPresets(0);
      if (event.key === "2") changePaletteFromPresets(1);
      if (event.key === "3") changePaletteFromPresets(2);
      if (event.key === "4") changePaletteFromPresets(3);
      if (event.key === "5") changePaletteFromPresets(4);
      if (event.key === "6") changePaletteFromPresets(5);
      if (event.key === "7") changePaletteFromPresets(6);
      if (event.key === "8") changePaletteFromPresets(7);
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
    const time = getStore("animationTime");
    const step = getStore("animationCycleStep");

    if (time > 0) {
      elapsed += p.deltaTime;

      if (elapsed > time) {
        elapsed = elapsed % time;
        cycleCurrentPaletteOffset(step);
      }
    }

    const mainBuffer = nextBuffer(p);

    p.background(0);

    if (isTranslatingMainBuffer) {
      if (draggingMode === "move") {
        const { pixelDiffX, pixelDiffY } = getDraggingPixelDiff(p);
        p.image(mainBuffer, pixelDiffX, pixelDiffY);
        drawCrossHair(p);
      } else if (draggingMode === "zoom") {
        const { mouseX, mouseY } = mouseClickedOn;
        const { pixelDiffY } = getDraggingPixelDiff(p);

        // 上にドラッグで拡大、下にドラッグで縮小
        // 拡大時は感度強め
        const zoomMultiplier = pixelDiffY < 0 ? 0.1 : 0.01;
        const zoomFactor = 1 + pixelDiffY * -zoomMultiplier;

        const minSize = 20;

        // 新しい幅と高さを計算
        const newWidth = Math.max(mainBuffer.width * zoomFactor, minSize);
        const newHeight = Math.max(mainBuffer.height * zoomFactor, minSize);

        // クリック位置を中心にするためのオフセット計算
        const offsetX = mouseX - (mouseX * newWidth) / mainBuffer.width;
        const offsetY = mouseY - (mouseY * newHeight) / mainBuffer.height;

        // ズーム適用
        p.image(mainBuffer, offsetX, offsetY, newWidth, newHeight);
      }
    } else {
      p.image(mainBuffer, 0, 0);
    }

    drawInfo(p);

    if (shouldSavePOIHistoryNextRender) {
      shouldSavePOIHistoryNextRender = false;
      addCurrentLocationToPOIHistory();
    }

    if (paramsChanged()) {
      startCalculation(
        (elapsed: number) => {
          // elapsed=0は中断時なのでなにもしない
          if (elapsed !== 0) {
            // 次回のrendering後にPOIHistoryを更新する
            shouldSavePOIHistoryNextRender = true;
          }
        },
        // onTranslated - cacheのtranslateとmainBufferへの書き込みが済んでから描画位置を戻す
        () => (isTranslatingMainBuffer = false),
      );
    }
  };
};

const entrypoint = () => {
  createStore();

  // localStorageから復帰
  const hydratedPOIList = readPOIListFromStorage();
  updateStore("poi", hydratedPOIList);

  const hydratedSettings = readSettingsFromStorage();
  Object.keys(hydratedSettings).forEach((key) => {
    if (isSettingField(key)) {
      updateStore(key, hydratedSettings[key] ?? 1);
    }
  });
  updateStore("zoomRate", hydratedSettings.zoomRate);

  // hydrateしたworkerCountの値でworkerを初期化する
  prepareWorkerPool(getStore("workerCount"), getStore("mode"));

  const p5root = document.getElementById("p5root");
  new p5(sketch, p5root!);

  // Canvas以外の要素
  const container = document.getElementById("app-root")!;
  ReactDOMClient.createRoot(container).render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>,
  );
};

entrypoint();
