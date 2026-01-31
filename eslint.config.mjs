import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import reactRefresh from "eslint-plugin-react-refresh";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

// Backend: Node + TypeScript (restrict compat configs to backend files)
const backendCompat = compat
  .extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  )
  .map((c) => ({ ...c, files: ["backend/**/*.ts"] }));

// Frontend: Browser + TypeScript + React (react-refresh added manually — its recommended config is not FlatCompat-compatible)
const frontendCompat = compat
  .extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  )
  .map((c) => ({ ...c, files: ["frontend/**/*.{ts,tsx}"] }));

export default defineConfig([
  ...backendCompat,
  {
    files: ["backend/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  ...frontendCompat,
  {
    files: ["frontend/**/*.{ts,tsx}"],
    plugins: { "react-refresh": reactRefresh },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: "detect" } },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
]);
