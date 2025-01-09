import BigNumber from "bignumber.js";
import { eventmit } from "eventmit";
import { useEffect, useState } from "react";
import {
  isSettingField,
  writeSettingsToStorage,
} from "./sync-storage/settings";

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
  // BigNumberはeqで比較
  if (value instanceof BigNumber && value.eq(store[key])) return;
  // progressがobjectなので、totalが同じなら更新しない
  if (value != null && value.total != null && value.total === store[key].total)
    return;

  store[key] = value;

  // FIXME: 無関係の更新時もここでチェックが入るのはどうなのかという気もする
  if (isSettingField(key)) {
    writeSettingsToStorage();
  }

  event.emit(key);
};

export const updateStoreWith = <T extends any>(
  key: string,
  f: (value: T) => T,
) => {
  const newValue = f(store[key]);
  updateStore(key, newValue);

  return newValue;
};

export const useStoreValue = <T = any>(key: string) => {
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

  return value as T;
};
