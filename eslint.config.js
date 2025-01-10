// @ts-check

import eslint from "@eslint/js";
import pluginReactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import { fixupPluginRules } from "@eslint/compat";

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
  { ignores: ["dist/", "src/components/ui/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
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
