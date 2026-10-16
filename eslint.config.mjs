import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  { ignores: ["node_modules/**", "dist/**", "tests/**", "eslint.config.mjs"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["main.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.browser, ...globals.node },
    },
    // main.js is the directly executable CommonJS entry loaded by Obsidian.
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
