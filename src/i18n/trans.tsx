import { en } from "./en";
import { useT } from "./context";
import type { DictKey, DictValue } from "./types";

/**
 * 英語値からキーを逆引きするマップ（ランタイム）
 *
 * 値が重複している場合は最初に見つかったキーになる。
 * 重複がある場合はTransにidを指定して使う運用ルール。
 */
const valueToKeyMap = new Map<string, DictKey>();
for (const [key, value] of Object.entries(en)) {
  if (!valueToKeyMap.has(value)) {
    valueToKeyMap.set(value, key as DictKey);
  }
}

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
    return t(id);
  }

  const key = valueToKeyMap.get(children);
  if (key == null) {
    // 型で防ぐので通常到達しない。フォールバックとしてchildrenをそのまま返す
    return children;
  }

  return t(key);
};
