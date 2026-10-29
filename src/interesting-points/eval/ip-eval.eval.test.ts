import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findPeaks } from "../peak-detector";
import { computeScene, type Scene } from "./compute-scene";
import expectedJson from "./expected.json";
import { evaluateScene, type SceneMetrics } from "./metrics";
import { renderHeatmap, renderScene, type ExpectedPoint } from "./render-scene";
import scenesJson from "./scenes.json";

/**
 * interesting points 検出の仮説検証ループ。
 *
 * 各シーンの iteration buffer を node 上で計算し（初回のみ、以後は tmp/ip-eval/cache/ を使う）、
 * 検出結果と期待点を重ねた PNG と、再現率・誤検出数のレポートを tmp/ip-eval/ に出力する。
 *
 * 実行: `pnpm eval:ip`（`pnpm test` からは除外されている）
 */

const OUT_DIR = join(process.cwd(), "tmp", "ip-eval");
const CACHE_DIR = join(OUT_DIR, "cache");
/** 期待点とマーカーの許容距離（px）。画面短辺の3% */
const TOLERANCE_RATIO = 0.03;

const scenes = scenesJson as Scene[];
const expectedMap = expectedJson as Record<string, ExpectedPoint[]>;

const loadBuffer = (scene: Scene): Uint32Array => {
  const path = join(CACHE_DIR, `${scene.name}.bin`);
  if (existsSync(path)) return new Uint32Array(readFileSync(path).buffer.slice(0));
  const buffer = computeScene(scene);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, Buffer.from(buffer.buffer));
  return buffer;
};

describe("interesting points eval", () => {
  it("全シーンを評価してレポートを出力する", { timeout: 600000 }, () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const lines: string[] = [
      "| scene | hit/expected | falsePositive | violation | detected | ms |",
      "|---|---|---|---|---|---|",
    ];
    const total: SceneMetrics = {
      hit: 0,
      expected: 0,
      falsePositive: 0,
      detected: 0,
      violation: 0,
    };

    for (const scene of scenes) {
      const buffer = loadBuffer(scene);
      const started = performance.now();
      const { points, map } = findPeaks(buffer, scene.width, scene.height, scene.N);
      const ms = Math.round(performance.now() - started);
      const expected = expectedMap[scene.name] ?? [];
      const tolerance = Math.min(scene.width, scene.height) * TOLERANCE_RATIO;
      const m = evaluateScene(points, expected, tolerance);
      total.hit += m.hit;
      total.expected += m.expected;
      total.falsePositive += m.falsePositive;
      total.detected += m.detected;
      total.violation += m.violation;
      lines.push(
        `| ${scene.name} | ${m.hit}/${m.expected} | ${m.falsePositive} | ${m.violation} | ${m.detected} | ${ms} |`,
      );
      writeFileSync(
        join(OUT_DIR, `${scene.name}.png`),
        renderScene(buffer, scene.width, scene.height, scene.N, points, expected),
      );
      writeFileSync(
        join(OUT_DIR, `${scene.name}-heatmap.png`),
        renderHeatmap(map, scene.width, scene.height, points, expected),
      );
      writeFileSync(
        join(OUT_DIR, `${scene.name}.json`),
        JSON.stringify(
          points.map((p) => ({ x: p.x, y: p.y, iteration: p.iteration, score: p.score })),
          null,
          2,
        ),
      );
    }

    lines.push(
      `| **total** | ${total.hit}/${total.expected} | ${total.falsePositive} | ${total.violation} | ${total.detected} | |`,
    );
    writeFileSync(join(OUT_DIR, "report.md"), lines.join("\n") + "\n");
    expect(total.detected).toBeGreaterThan(0);
  });
});
