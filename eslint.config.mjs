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
    // Generated output, not source.
    "coverage/**",
    // Copied from node_modules before dev and build; not ours to lint.
    "public/vendor/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      // A leading underscore marks a parameter that exists to satisfy a
      // signature — an interface implementation, or a mock that must accept
      // the arguments it ignores.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
