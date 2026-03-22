import { getStore } from "../store";

import type { Locale } from "@/i18n/types";
import type { RendererType } from "@/rendering/common";

export type Settings = {
  locale: Locale;
  zoomRate: number;
  workerCount: number;
  animationTime: number;
  animationCycleStep: number;
  maxCanvasSize: number;
  rendererType: RendererType;
  supersamplingWidth: number;
  supersamplingHeight: number;
  showInterestingPoints: boolean;
  /** 常にIP debugデータを計算するか */
  alwaysComputeIPDebugData: boolean;
  /** Debug Modeで選択中のタブ */
  debugModeTab: string;
};

export const DEFAULT_WORKER_COUNT =
  process.env.NODE_ENV === "test" ? 1 : navigator.hardwareConcurrency;

/** ブラウザの言語設定からデフォルトのlocaleを判定する */
const detectDefaultLocale = (): Locale =>
  typeof navigator !== "undefined" && navigator.language.startsWith("ja") ? "ja" : "en";

const defaultSettings = {
  locale: detectDefaultLocale(),
  zoomRate: 2.0,
  workerCount: DEFAULT_WORKER_COUNT,
  animationTime: 0,
  animationCycleStep: 1,
  maxCanvasSize: -1,
  rendererType: "p5js" as RendererType,
  supersamplingWidth: 1920,
  supersamplingHeight: 1080,
  showInterestingPoints: false,
  alwaysComputeIPDebugData: false,
  debugModeTab: "batch-render",
} satisfies Settings;

export const isSettingField = (key: string): key is keyof Settings => key in defaultSettings;

export const writeSettingsToStorage = () => {
  const settings = {
    locale: getStore("locale"),
    zoomRate: getStore("zoomRate"),
    workerCount: getStore("workerCount"),
    animationTime: getStore("animationTime"),
    animationCycleStep: getStore("animationCycleStep"),
    maxCanvasSize: getStore("maxCanvasSize"),
    rendererType: getStore("rendererType"),
    supersamplingWidth: getStore("supersamplingWidth"),
    supersamplingHeight: getStore("supersamplingHeight"),
    showInterestingPoints: getStore("showInterestingPoints"),
    alwaysComputeIPDebugData: getStore("alwaysComputeIPDebugData"),
    debugModeTab: getStore("debugModeTab"),
  } satisfies Settings;

  const serialized = JSON.stringify(settings);
  localStorage.setItem("settings", serialized);
};

export const readSettingsFromStorage = (): Settings => {
  const serialized = localStorage.getItem("settings");
  if (!serialized) return { ...defaultSettings };

  try {
    const result = JSON.parse(serialized);
    return { ...defaultSettings, ...result };
  } catch (e) {
    console.error(e);
    return { ...defaultSettings };
  }
};
