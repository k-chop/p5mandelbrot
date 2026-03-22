import { en } from "./en";
import type { DictKey } from "./types";

/**
 * 英語値からキーを逆引きするマップ（ランタイム）
 *
 * 値が重複している場合は最初に見つかったキーになる。
 * 重複がある場合はidを指定して使う運用ルール。
 */
export const valueToKeyMap = new Map<string, DictKey>();
for (const [key, value] of Object.entries(en)) {
  if (!valueToKeyMap.has(value)) {
    valueToKeyMap.set(value, key as DictKey);
  }
}
