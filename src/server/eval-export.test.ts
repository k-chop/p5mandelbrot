import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeDataURL, getNextPointIndex, saveEvalData } from "./eval-export";

const TEST_DIR = join(process.cwd(), "tmp", "test-eval");

/** テスト用の最小DataURL */
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

describe("getNextPointIndex", () => {
  it("ディレクトリが存在しない場合は1を返す", () => {
    expect(getNextPointIndex(TEST_DIR)).toBe(1);
  });

  it("空ディレクトリの場合は1を返す", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    expect(getNextPointIndex(TEST_DIR)).toBe(1);
  });

  it("既存のpoint-Nディレクトリの最大番号+1を返す", () => {
    mkdirSync(join(TEST_DIR, "point-1"), { recursive: true });
    mkdirSync(join(TEST_DIR, "point-3"), { recursive: true });
    expect(getNextPointIndex(TEST_DIR)).toBe(4);
  });

  it("point-N以外のディレクトリやファイルは無視する", () => {
    mkdirSync(join(TEST_DIR, "point-2"), { recursive: true });
    mkdirSync(join(TEST_DIR, "other-dir"), { recursive: true });
    writeFileSync(join(TEST_DIR, "point-5.txt"), "not a dir");
    expect(getNextPointIndex(TEST_DIR)).toBe(3);
  });
});

describe("decodeDataURL", () => {
  it("DataURLからバイナリデータを抽出する", () => {
    const buffer = decodeDataURL(TINY_PNG_DATA_URL);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PNGマジックナンバーを確認
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // 'P'
    expect(buffer[2]).toBe(0x4e); // 'N'
    expect(buffer[3]).toBe(0x47); // 'G'
  });

  it("不正なDataURLでエラーを投げる", () => {
    expect(() => decodeDataURL("invalid-data")).toThrow("Invalid DataURL format");
  });
});

describe("saveEvalData", () => {
  it("screenshot.pngとsummary.jsonを正しく保存する", () => {
    const summary = { scoring: "symmetry", selectedPoints: [] };

    const pointIndex = saveEvalData(TEST_DIR, TINY_PNG_DATA_URL, summary);

    expect(pointIndex).toBe(1);
    expect(existsSync(join(TEST_DIR, "point-1", "screenshot.png"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "point-1", "summary.json"))).toBe(true);

    // PNG内容を確認
    const png = readFileSync(join(TEST_DIR, "point-1", "screenshot.png"));
    expect(png[0]).toBe(0x89);

    // JSON内容を確認
    const json = JSON.parse(readFileSync(join(TEST_DIR, "point-1", "summary.json"), "utf-8"));
    expect(json.scoring).toBe("symmetry");
  });

  it("連番で保存される", () => {
    const summary = { test: true };

    const idx1 = saveEvalData(TEST_DIR, TINY_PNG_DATA_URL, summary);
    const idx2 = saveEvalData(TEST_DIR, TINY_PNG_DATA_URL, summary);
    const idx3 = saveEvalData(TEST_DIR, TINY_PNG_DATA_URL, summary);

    expect(idx1).toBe(1);
    expect(idx2).toBe(2);
    expect(idx3).toBe(3);
  });
});
