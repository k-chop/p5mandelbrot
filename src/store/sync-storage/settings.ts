import { getStore } from "../store";

export type Settings = {
  zoomRate: number;
  workerCount: number;
  animationTime: number;
};

export const DEFAULT_WORKER_COUNT = navigator.hardwareConcurrency;

const defaultSettings = {
  zoomRate: 2.0,
  workerCount: DEFAULT_WORKER_COUNT,
  animationTime: 0,
} satisfies Settings;

export const isSettingField = (key: string): key is keyof Settings =>
  key in defaultSettings;

export const writeSettingsToStorage = () => {
  const settings = {
    zoomRate: getStore("zoomRate"),
    workerCount: getStore("workerCount"),
    animationTime: getStore("animationTime"),
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
