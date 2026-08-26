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
    "next-env.d.ts",

    // DevStudio is a vendored copy of the overlay from the portfolio repo,
    // where it was written against Astro's lint config. Next's config turns on
    // React Compiler rules (react-hooks/refs and friends) that flag patterns
    // throughout it. They're compiler-friendliness rules, not bugs — the
    // component has been in daily use — and rewriting 1200 lines of a working
    // tool to satisfy a linter it was never written for would risk changing how
    // it behaves. It never ships to production either way.
    "src/components/dev-studio/**",
  ]),
]);

export default eslintConfig;
