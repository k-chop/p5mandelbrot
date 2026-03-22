import { useT } from "./context";
import type { DictKey } from "./types";

type TransProps = {
  /** 翻訳キー。指定するとキーで辞書を引く。省略するとchildrenのenの値から逆引きする */
  id?: DictKey;
  /** enの値（可読性のため。JSXテキストの制約で型検証不可） */
  children: string;
};

/**
 * 翻訳コンポーネント
 *
 * パターン1: `<Trans>Share</Trans>` — enの値から逆引き
 * パターン2: `<Trans id="header.share">Share</Trans>` — idで直接指定
 *
 * 型安全が必要な場合は `t()` 関数を使用する。
 * Transはコードの可読性（何が表示されるか一目で分かる）のために使う。
 */
export const Trans = ({ id, children }: TransProps) => {
  const t = useT();

  if (id != null) {
    return t(children as Parameters<typeof t>[0], id);
  }

  return t(children as Parameters<typeof t>[0]);
};
