import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // *.bench.test.ts は速度計測用で数十秒かかるため通常のテストからは外す。
    // 実行は `pnpm bench:wasm` / `pnpm eval:ip`
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.bench.test.ts", "**/*.eval.test.ts"],
  },
});
