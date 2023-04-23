import { eventmit } from "eventmit";
import { useEffect, useState } from "react";

let store: any = {};

type Store<T> = T;

const event = eventmit<string>();

export const createStore = <T>(value: T): Store<T> => {
  store = { ...value };
  return store;
};

export const getStore = (key: string) => store[key];

export const updateStore = (key: string, value: any) => {
  if (store[key] === value) return;

  store[key] = value;
  event.emit(key);
};

export const useStoreValue = (key: string) => {
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
  }, []);

  return value;
};
