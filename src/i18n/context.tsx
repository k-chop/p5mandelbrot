import { createContext, use, useCallback, useMemo } from "react";
import { en } from "./en";
import { ja } from "./ja";
import type { DictKey, Locale } from "./types";

const dictionaries = { en, ja } as const;

type I18nContextValue = {
  locale: Locale;
  t: (key: DictKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  locale: Locale;
  children: React.ReactNode;
};

/** i18n Provider */
export const I18nProvider = ({ locale, children }: I18nProviderProps) => {
  const t = useCallback((key: DictKey) => dictionaries[locale][key], [locale]);

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext value={value}>{children}</I18nContext>;
};

/**
 * 翻訳関数を取得するhook
 *
 * @returns 翻訳キーを受け取り翻訳済み文字列を返す関数
 */
export const useT = (): ((key: DictKey) => string) => {
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
