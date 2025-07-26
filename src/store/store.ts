import type { POIData, ResultSpans } from "@/types";
import BigNumber from "bignumber.js";
import { eventmit } from "eventmit";
import { useEffect, useState } from "react";
import {
  isSettingField,
  writeSettingsToStorage,
} from "./sync-storage/settings";

type Store = {
  // mandelbrot params
  centerX: BigNumber;
  centerY: BigNumber;
  mouseX: BigNumber;
  mouseY: BigNumber;
  r: BigNumber;
  N: number;
  iteration: number | string;
  mode: "normal" | "perturbation";

  // POI List
  poi: POIData[];

  // Settings
  zoomRate: number;
  workerCount: number;
  animationTime: number;
  refOrbitWorkerCount: number;
  /**
   * 最大キャンバスサイズ
   *
   * -1なら無制限
   * 値があればcanvasの縦横幅はこの値以上にならない
   */
  maxCanvasSize: number;

  // UI state
  canvasLocked: boolean;

  // mandelbrot state
  shouldReuseRefOrbit: boolean;

  // palette settings
  paletteLength: number;
  paletteOffset: number;
  animationCycleStep: number;

  // state
  progress: string | ResultSpans;
  /** 現在使用中のrenderer */
  rendererType: "webgpu" | "p5js";
  /** Debug Mode中か否か */
  isDebugMode: boolean;
};

const store: Store = {
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
  animationTime: 0,
  refOrbitWorkerCount: 1, // 仮
  maxCanvasSize: -1,
  // UI state
  canvasLocked: false,
  // mandelbrot state
  shouldReuseRefOrbit: false,
  // palette settings
  paletteLength: 128,
  paletteOffset: 0,
  animationCycleStep: 1,
  // state
  progress: "",
  rendererType: "p5js",
  isDebugMode: false,
};

const event = eventmit<string>();

export const createStore = (): Store => {
  return store;
};

export const getStore = <Key extends keyof Store>(key: Key) => store[key];

export const updateStore = <Key extends keyof Store>(
  key: Key,
  value: Store[Key],
) => {
  if (store[key] === value) return;
  // BigNumberはeqで比較
  if (value instanceof BigNumber && value.eq(store[key] as BigNumber)) return;
  // progressがobjectなので、totalが同じなら更新しない
  // @ts-expect-error 手抜き
  if (value != null && value.total != null && value.total === store[key].total)
    return;

  store[key] = value;

  // FIXME: 無関係の更新時もここでチェックが入るのはどうなのかという気もする
  if (isSettingField(key)) {
    writeSettingsToStorage();
  }

  event.emit(key);
};

export const updateStoreWith = <Key extends keyof Store>(
  key: Key,
  f: (value: Store[Key]) => Store[Key],
) => {
  const newValue = f(store[key]);
  updateStore(key, newValue);

  return newValue;
};

export const useStoreValue = <Key extends keyof Store>(key: Key) => {
  const [value, setValue] = useState(getStore(key));

  useEffect(() => {
    const handler = (storeKey: string) => {
      if (key === storeKey) {
        setValue(getStore(key));
      }
    };
    event.on(handler);

    return () => {
      event.off(handler);
    };
  }, [key]);

  return value as Store[Key];
};
