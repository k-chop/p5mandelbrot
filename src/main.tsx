import p5 from "p5";
import React from "react";
import ReactDOMClient from "react-dom/client";
import {
  p5Draw,
  p5KeyPressed,
  p5MouseDragged,
  p5MousePressed,
  p5MouseReleased,
  p5MouseWheel,
  p5Setup,
} from "./p5-adapter/p5-adapter";
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
    p5MousePressed(p);
  };

  p.mouseDragged = (ev: MouseEvent) => {
    p5MouseDragged(p, ev);
  };

  p.mouseReleased = (ev: MouseEvent) => {
    p5MouseReleased(p, ev);
  };

  p.mouseWheel = (event: WheelEvent) => {
    p5MouseWheel(p, event);
  };

  p.keyPressed = (event: KeyboardEvent | undefined) => {
    p5KeyPressed(p, event);
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
