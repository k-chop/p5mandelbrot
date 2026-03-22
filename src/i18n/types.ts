import type { en } from "./en";

/** サポートするロケール */
export type Locale = "en" | "ja";

/** 辞書のキーの型 */
export type DictKey = keyof typeof en;

/** 辞書型 — enと同じキーセットを強制 */
export type Dictionary = { readonly [K in DictKey]: string };

/** enの辞書の値の型（ユニオン） */
export type DictValue = (typeof en)[DictKey];
