import { readFileSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { calculate, initSync } from "../../wasm-fp/pkg/apfp.js";

/**
 * wasm-fp の reference orbit ループの速度を limb 数ごとに測るローカル用ベンチ。
 *
 * codegen (opt-level, 単相化の有無) を変えたときに ns/iter がどう動くかを
 * ブラウザで測らずに比較するためのもの。assertは持たず結果をprintlnするだけ。
 * 実行: `pnpm test apfp-bench -- --reporter=basic`
 */

/** 集合内部寄りでescapeしにくい深いズーム座標 (bench POI heavy-n-light-iter) */
const X =
  "0.2701237597337648151468089210872559290330585338404586945480880642375286137466902863822947734726893678732504691531952149442643761738093667891894268910326695338694216593260";
const Y =
  "0.005009229312393684589400299097118026037794249881626541648326951827106797599030593628796825598542781592179428913547715184471643655974682851388677903558858892738831120008779";

const MAX_ITER = 60000;
const LIMB_COUNTS = [5, 9, 12, 13, 20, 32];
const RUNS = 3;

/**
 * 1回計算して所要時間と反復数を返す
 */
const measure = (activeLimbs: number): { ms: number; iters: number } => {
  const started = performance.now();
  const orbit = calculate({
    type: "reference_orbit",
    x: X,
    y: Y,
    max_iter: MAX_ITER,
    active_limbs: activeLimbs,
  }) as Float64Array;
  return { ms: performance.now() - started, iters: orbit.length / 2 };
};

describe("apfp reference orbit bench", () => {
  beforeAll(() => {
    const wasmPath = new URL("../../public/wasm/apfp_bg.wasm", import.meta.url);
    initSync({ module: readFileSync(wasmPath) });
  });

  it("limb数ごとのns/iterを出す", { timeout: 600000 }, () => {
    const lines: string[] = [];

    for (const limbs of LIMB_COUNTS) {
      // wasmのtier upを待つためのウォームアップ
      measure(limbs);
      measure(limbs);

      const samples: number[] = [];
      let iters = 0;
      for (let i = 0; i < RUNS; i++) {
        const r = measure(limbs);
        samples.push((r.ms * 1e6) / r.iters);
        iters = r.iters;
      }

      const best = Math.min(...samples);
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      lines.push(
        `${String(limbs).padStart(2)} limbs: iters=${String(iters).padStart(6)}` +
          ` best=${best.toFixed(1).padStart(7)} ns/iter  mean=${mean.toFixed(1).padStart(7)}`,
      );
    }

    expect(lines).toHaveLength(LIMB_COUNTS.length);
    writeFileSync("tmp/apfp-bench.txt", `${lines.join("\n")}\n`);
  });
});
