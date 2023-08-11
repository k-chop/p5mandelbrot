import { get, set, del } from "idb-keyval";

export const savePreview = (id: string, imageDataURL: string) => {
  set(id, imageDataURL);
};

export const loadPreview = async (id: string) => {
  return await get(id);
};

export const deletePreview = async (id: string) => {
  await del(id);
};
