// @ts-check

import { fixupPluginRules } from "@eslint/compat";
import eslint from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import tailwind from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    plugins: {
      // @ts-expect-error 型が合わない
      "react-hooks": fixupPluginRules(pluginReactHooks),
    },
    // @ts-expect-error 型が合わない
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
    },
  },
  { ignores: ["dist/", "src/shadcn/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactPlugin.configs.flat?.recommended,
  reactPlugin.configs.flat?.["jsx-runtime"],
  tailwind.configs["flat/recommended"],
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
);
