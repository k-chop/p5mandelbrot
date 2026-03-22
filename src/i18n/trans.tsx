import { en } from "./en";
import { useT } from "./context";
import type { DictKey, DictValue } from "./types";

/**
 * 翻訳コンポーネント
 *
 * パターン1: `<Trans>Share</Trans>` — enの値から逆引き
 * パターン2: `<Trans id="header.share">Share</Trans>` — idで直接指定、childrenがen[id]と一致するか型検証
 */
export const Trans: {
  /** パターン1: idなし — childrenがenのvalueに存在すること */
  (props: { id?: undefined; children: DictValue }): React.ReactNode;
  /** パターン2: idあり — childrenがen[id]と一致すること */
  <K extends DictKey>(props: { id: K; children: (typeof en)[K] }): React.ReactNode;
} = ({ id, children }: { id?: DictKey; children: string }) => {
  const t = useT();

  if (id != null) {
    return t(children as DictValue, id);
  }

  return t(children as DictValue);
};
