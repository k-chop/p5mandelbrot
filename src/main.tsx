import p5 from "p5";
import React from "react";
import ReactDOMClient from "react-dom/client";
import {
  changeDraggingState,
  changeToMousePressedState,
  keyInputHandler,
  p5Draw,
  p5MouseReleased,
  p5Setup,
  zoomTo,
} from "./p5-adapter/p5-adapter";
import { isInside, isOnUIOverlay } from "./p5-adapter/utils";
import { createStore, getStore, updateStore } from "./store/store";
import { readPOIListFromStorage } from "./store/sync-storage/poi-list";
import { isSettingField, readSettingsFromStorage } from "./store/sync-storage/settings";
import "./style.css";
import { AppRoot } from "./view/app-root";
import { prepareWorkerPool } from "./worker-pool/pool-instance";

// p5 object
const sketch = (p: p5) => {
  p.setup = async () => {
    // 非同期関数として実行
    await p5Setup(p);
  };

  p.mousePressed = (ev: MouseEvent) => {
    if (isOnUIOverlay(ev)) return;
    if (getStore("canvasLocked")) return;
    if (isInside(p)) {
      changeToMousePressedState(p);
    }
  };

  p.mouseDragged = (ev: MouseEvent) => {
    if (isOnUIOverlay(ev)) return;
    ev.preventDefault();

    if (ev.buttons === 1) {
      changeDraggingState("move", p);
    } else if (ev.buttons === 2) {
      changeDraggingState("zoom", p);
    }
  };

  p.mouseReleased = (ev: MouseEvent) => {
    if (isOnUIOverlay(ev)) return;
    p5MouseReleased(p, ev);
  };

  p.mouseWheel = (event: WheelEvent) => {
    if (isOnUIOverlay(event)) return;
    if (!isInside(p)) return;
    if (getStore("canvasLocked")) return;

    event.preventDefault();

    zoomTo(event.deltaY > 0);
  };

  p.keyPressed = (event: KeyboardEvent | undefined) => {
    if (getStore("canvasLocked")) return;

    if (event) {
      event.preventDefault();
      keyInputHandler(event);
    }
  };

  p.draw = () => {
    p5Draw(p);
  };

  // キャンバスサイズはsettingsのmaxCanvasSizeで制御する。
  // windowResizedによる自動リサイズは無効化（フローティングパネルの開閉で不要なリサイズが走るため）
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
  void prepareWorkerPool(getStore("workerCount"), getStore("mode"));

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

// lets goooooooooooo
entrypoint();
