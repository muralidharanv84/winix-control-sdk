import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["examples/**/*.mjs", "test/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["examples/deno/**/*.ts"],
    languageOptions: { globals: { Deno: "readonly" } },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
