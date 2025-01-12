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
import { isInside } from "./p5-adapter/utils";
import { createStore, getStore, updateStore } from "./store/store";
import { readPOIListFromStorage } from "./store/sync-storage/poi-list";
import {
  isSettingField,
  readSettingsFromStorage,
} from "./store/sync-storage/settings";
import "./style.css";
import { AppRoot } from "./view/app-root";
import { prepareWorkerPool } from "./worker-pool/pool-instance";

// p5 object
const sketch = (p: p5) => {
  p.setup = () => {
    p5Setup(p);
  };

  p.mousePressed = () => {
    if (getStore("canvasLocked")) return;
    if (isInside(p)) {
      changeToMousePressedState(p);
    }
  };

  p.mouseDragged = (ev: MouseEvent) => {
    ev.preventDefault(); // 問答無用で止めて良い

    if (ev.buttons === 1) {
      // RMB
      changeDraggingState("move", p);
    } else if (ev.buttons === 2) {
      // LMB
      changeDraggingState("zoom", p);
    }
  };

  p.mouseReleased = (ev: MouseEvent) => {
    p5MouseReleased(p, ev);
  };

  p.mouseWheel = (event: WheelEvent) => {
    if (!isInside(p)) return;
    if (getStore("canvasLocked")) return;

    event.preventDefault(); // canvas内ではスクロールしないように

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

// lets goooooooooooo
entrypoint();
