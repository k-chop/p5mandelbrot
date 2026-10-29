import { describe, expect, it } from "vitest";
import { decodeDataURL } from "./preset-poi";

/** テスト用の最小DataURL */
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("decodeDataURL", () => {
  it("DataURLからバイナリデータを抽出する", () => {
    const buffer = decodeDataURL(TINY_PNG_DATA_URL);
    expect(buffer).toBeInstanceOf(Buffer);
    // PNGマジックナンバーを確認
    expect([...buffer.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("不正なDataURLでエラーを投げる", () => {
    expect(() => decodeDataURL("invalid-data")).toThrow("Invalid DataURL format");
  });
});
