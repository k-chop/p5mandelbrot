import { eventmit } from "eventmit";
import { del, get, set } from "idb-keyval";
import { useEffect, useState } from "react";

const event = eventmit<string>();

export const savePreview = (id: string, imageDataURL: string) => {
  set(id, imageDataURL);
  event.emit(id);
};

export const loadPreview = async (id: string) => {
  return await get(id);
};

export const deletePreview = async (id: string) => {
  await del(id);
  event.emit(id);
};

export const useTrackChangePreview = (id: string) => {
  const [value, setValue] = useState(false);

  useEffect(() => {
    const handler = (changedId: string) => {
      if (id === changedId) {
        setValue((value) => !value);
      }
    };
    event.on(handler);

    return () => {
      event.off(handler);
    };
  }, []);

  return value;
};
