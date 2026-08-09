import { defineConfig } from "vitest/config";

/** 速度計測用。`.wasm` を差し替えて同一セッション内でA/Bするのに使う */
export default defineConfig({
  test: {
    include: ["src/**/*.bench.test.ts"],
    testTimeout: 600000,
  },
});
