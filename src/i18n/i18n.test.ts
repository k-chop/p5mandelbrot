import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ja } from "./ja";
import type { DictKey } from "./types";

describe("i18n辞書", () => {
  it("jaの辞書はenと同じキーセットを持つ", () => {
    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();
    expect(jaKeys).toEqual(enKeys);
  });

  it("jaの辞書に空文字列のエントリがない", () => {
    for (const [key, value] of Object.entries(ja)) {
      expect(value, `ja["${key}"] が空文字列`).not.toBe("");
    }
  });

  it("enの辞書に空文字列のエントリがない", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en["${key}"] が空文字列`).not.toBe("");
    }
  });
});

describe("valueToKeyMap（値からキーの逆引き）", () => {
  /**
   * enの辞書からvalueToKeyMapを構築する
   * （trans.tsxと同じロジック）
   */
  const buildValueToKeyMap = () => {
    const map = new Map<string, DictKey>();
    for (const [key, value] of Object.entries(en)) {
      if (!map.has(value)) {
        map.set(value, key as DictKey);
      }
    }
    return map;
  };

  it("enのすべての値がマップに含まれる", () => {
    const map = buildValueToKeyMap();
    for (const value of Object.values(en)) {
      expect(map.has(value), `"${value}" がマップに含まれていない`).toBe(true);
    }
  });

  it("マップから逆引きしたキーでenを引くと元の値が得られる", () => {
    const map = buildValueToKeyMap();
    for (const [_key, value] of Object.entries(en)) {
      const reversedKey = map.get(value);
      expect(reversedKey).toBeDefined();
      // 重複がなければreversedKey === key、重複があれば最初に登録されたキーになる
      expect(en[reversedKey!]).toBe(value);
    }
  });
});
