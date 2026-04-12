import type { Locale } from "@/i18n/types";
import type { InterestingPointsDebugData } from "@/interesting-points/find-interesting-points";
import type { POIData, ResultSpans } from "@/types";
import BigNumber from "bignumber.js";
import { eventmit } from "eventmit";
import { useEffect, useState } from "react";
import { isSettingField, writeSettingsToStorage } from "./sync-storage/settings";

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
  locale: Locale;
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
  /** POIパネルの開閉状態 */
  poiPanelOpen: boolean;

  // mandelbrot state
  /** reference orbit計算にwasmを使うかどうか */
  useWasm: boolean;
  /** 手動指定の limb 数 override（null なら自動計算） */
  manualLimbsOverride: number | null;

  // palette settings
  paletteId: string;
  paletteLength: number;
  paletteOffset: number;
  animationCycleStep: number;

  // supersampling settings
  supersamplingWidth: number;
  supersamplingHeight: number;

  // state
  progress: string | ResultSpans;
  /** 現在使用中のrenderer */
  rendererType: "webgpu" | "p5js";
  /** Debug Mode中か否か */
  isDebugMode: boolean;
  /** 興味深いポイントマーカーを表示するか */
  showInterestingPoints: boolean;
  /** 常にIP debugデータを計算するか */
  alwaysComputeIPDebugData: boolean;
  /** Debug Modeで選択中のタブ */
  debugModeTab: string;
  /** 興味深いポイント検出のデバッグデータ */
  interestingPointsDebugData: InterestingPointsDebugData | null;
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
  locale: "en",
  zoomRate: 2.0,
  workerCount: 2,
  animationTime: 0,
  refOrbitWorkerCount: 1, // 仮
  maxCanvasSize: 800,
  // UI state
  canvasLocked: false,
  poiPanelOpen: true,
  // mandelbrot state
  useWasm: true,
  manualLimbsOverride: null,
  // palette settings
  paletteId: "d3-chromatic,RdYlBlu,1",
  paletteLength: 128,
  paletteOffset: 0,
  animationCycleStep: 1,
  // supersampling settings
  supersamplingWidth: 1920,
  supersamplingHeight: 1080,
  // state
  progress: "",
  rendererType: "p5js",
  isDebugMode: false,
  showInterestingPoints: false,
  alwaysComputeIPDebugData: false,
  debugModeTab: "batch-render",
  interestingPointsDebugData: null,
};

const event = eventmit<string>();

export const createStore = (): Store => {
  return store;
};

export const getStore = <Key extends keyof Store>(key: Key) => store[key];

export const updateStore = <Key extends keyof Store>(key: Key, value: Store[Key]) => {
  if (store[key] === value) return;
  // BigNumberはeqで比較
  if (value instanceof BigNumber && value.eq(store[key] as BigNumber)) return;
  // progressがobjectなので、totalが同じなら更新しない
  // @ts-expect-error 手抜き
  if (value != null && value.total != null && value.total === store[key].total) return;

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
