import { createContext, use, useCallback, useMemo } from "react";
import { en } from "./en";
import { ja } from "./ja";
import type { DictKey, DictValue, Locale } from "./types";
import { valueToKeyMap } from "./value-to-key-map";

const dictionaries = { en, ja } as const;

/**
 * t関数の型
 *
 * パターン1: `t("Share")` — enの値から逆引き
 * パターン2: `t("Share", "header.share")` — idで直接指定、第1引数がen[id]と一致するか型検証
 */
export type TFunction = {
  (value: DictValue): string;
  <K extends DictKey>(value: (typeof en)[K], id: K): string;
};

type I18nContextValue = {
  locale: Locale;
  t: TFunction;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  locale: Locale;
  children: React.ReactNode;
};

/** i18n Provider */
export const I18nProvider = ({ locale, children }: I18nProviderProps) => {
  const t = useCallback(
    ((value: string, id?: DictKey) => {
      if (id != null) {
        return dictionaries[locale][id];
      }
      const key = valueToKeyMap.get(value);
      if (key == null) {
        // 型で防ぐので通常到達しない。フォールバックとしてvalueをそのまま返す
        return value;
      }
      return dictionaries[locale][key];
    }) as TFunction,
    [locale],
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext value={value}>{children}</I18nContext>;
};

/**
 * 翻訳関数を取得するhook
 *
 * @returns 翻訳関数。`t("Share")` で値ベース逆引き、`t("Share", "header.share")` でid指定
 */
export const useT = (): TFunction => {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx.t;
};

/**
 * 現在のlocaleを取得するhook
 *
 * @returns 現在のロケール
 */
export const useLocale = (): Locale => {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx.locale;
};
