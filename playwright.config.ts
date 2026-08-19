import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests. These cover the journeys a broken unit test would not
 * catch: submitting a report, verifying an email, filtering the map.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // No real key, so the run records verification emails instead of
      // delivering them. A test must never put mail in a stranger's inbox.
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      RECOGNITION_SECRET: 'end-to-end-test-secret',
      NEXT_PUBLIC_SITE_URL: baseURL,
      // No DATABASE_URL on purpose. A test run must never write to a database
      // anybody relies on — an earlier version passed the developer's own
      // connection through and left rows behind in it. The run uses the
      // in-memory store instead, and anything that needs real data is covered
      // by component tests and by the repository contract, which runs against
      // Postgres deliberately.
      DATABASE_URL: '',
    },
  },
});
