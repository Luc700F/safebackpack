// Deliberately runs in a browser environment to prove the guard holds.
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { missingServerConfig, readServerConfig } from './env';

describe('readServerConfig in a browser', () => {
  it('refuses to read secrets, even with a complete environment', () => {
    expect(() =>
      readServerConfig({
        RESEND_API_KEY: 're_test_key',
        EMAIL_FROM: 'onboarding@resend.dev',
        RECOGNITION_SECRET: 'a-secret',
        DATABASE_URL: 'postgres://localhost/safebackpack',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      }),
    ).toThrowError(/never be read in the browser/);
  });

  it('still allows checking which variables are absent', () => {
    expect(missingServerConfig({})).toHaveLength(5);
  });
});
