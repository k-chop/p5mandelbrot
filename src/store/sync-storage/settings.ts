import { getStore } from "../store";

export type Settings = {
  zoomRate: number;
};

const defaultSettings = {
  zoomRate: 2.0,
} satisfies Settings;

export const isSettingField = (key: string): key is keyof Settings =>
  key in defaultSettings;

export const writeSettingsToStorage = () => {
  const settings = {
    zoomRate: getStore("zoomRate"),
  };
  const serialized = JSON.stringify(settings);
  localStorage.setItem("settings", serialized);
};

export const readSettingsFromStorage = (): Settings => {
  const serialized = localStorage.getItem("settings");
  if (!serialized) return { ...defaultSettings };

  try {
    return JSON.parse(serialized);
  } catch (e) {
    console.error(e);
    return { ...defaultSettings };
  }
};
