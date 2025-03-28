import { getStore } from "../store";

import type { RendererType } from "@/rendering/common";

export type Settings = {
  zoomRate: number;
  workerCount: number;
  animationTime: number;
  animationCycleStep: number;
  maxCanvasSize: number;
  rendererType: RendererType;
};

export const DEFAULT_WORKER_COUNT =
  process.env.NODE_ENV === "test" ? 1 : navigator.hardwareConcurrency;

const defaultSettings = {
  zoomRate: 2.0,
  workerCount: DEFAULT_WORKER_COUNT,
  animationTime: 0,
  animationCycleStep: 1,
  maxCanvasSize: -1,
  rendererType: "p5js" as RendererType,
} satisfies Settings;

export const isSettingField = (key: string): key is keyof Settings =>
  key in defaultSettings;

export const writeSettingsToStorage = () => {
  const settings = {
    zoomRate: getStore("zoomRate"),
    workerCount: getStore("workerCount"),
    animationTime: getStore("animationTime"),
    animationCycleStep: getStore("animationCycleStep"),
    maxCanvasSize: getStore("maxCanvasSize"),
    rendererType: getStore("rendererType"),
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
