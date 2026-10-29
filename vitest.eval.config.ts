import { defineConfig } from "vitest/config";

/** interesting points の検証ループ用。`pnpm eval:ip` で実行する */
export default defineConfig({
  test: {
    include: ["src/**/*.eval.test.ts"],
    testTimeout: 600000,
  },
});
