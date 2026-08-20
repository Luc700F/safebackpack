import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Honours the `@/*` alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    // End-to-end specs live in tests/e2e and are run by Playwright.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/components/**/*.tsx',
        'src/app/api/**/*.ts',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        // Interfaces and types only: nothing to execute, so a coverage tool
        // reports it as entirely uncovered and drags the total down.
        'src/lib/reports/repository.ts',
      ],
      thresholds: {
        /*
         * The gate sits on src/lib, which is where the project rule puts it:
         * every function there has unit tests, including its failure paths.
         * That code is framework-free and decides everything that matters —
         * retention, screening, validation, coordinates, tokens.
         *
         * Components and route handlers stay in the report but carry no gate.
         * They are covered by the Playwright journeys, which a coverage tool
         * running under Vitest cannot see, so a number here would be a lie in
         * one direction or the other.
         *
         * The numbers are a floor for the weakest supported setup: no
         * database, so the Postgres store and the connection pool count as
         * unreached. CI runs the same suite against a real PostGIS instance
         * and comfortably clears them.
         */
        'src/lib/**': {
          statements: 88,
          branches: 80,
          functions: 85,
          lines: 88,
        },
      },
    },
  },
});
