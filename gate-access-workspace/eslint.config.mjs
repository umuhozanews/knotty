import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".vercel/**",
    "scratch/**",
    "next-env.d.ts",
    "test_webcam_playwright.js",
    "verify_timetable_ui.js",
  ]),
  {
    rules: {
      // Keep the legacy `any` backlog visible without making the whole lint
      // command fail. New code should use explicit types or `unknown`.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react/no-unescaped-entities": "warn",
      "react/jsx-no-comment-textnodes": "warn",
    },
  },
]);

export default eslintConfig;
