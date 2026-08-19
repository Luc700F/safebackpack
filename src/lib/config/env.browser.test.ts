// Deliberately runs in a browser environment to prove the guard holds.
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { missingServerConfig, readEmailConfig, readSigningConfig } from './env';

const COMPLETE = {
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'onboarding@resend.dev',
  RECOGNITION_SECRET: 'a-secret',
  DATABASE_URL: 'postgres://localhost/safebackpack',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

describe('reading configuration in a browser', () => {
  it.each([
    ['signing', readSigningConfig],
    ['email', readEmailConfig],
  ])('refuses to read %s secrets', (_name, read) => {
    expect(() => read(COMPLETE)).toThrowError(/never be read in the browser/);
  });

  it('still allows checking which variables are absent', () => {
    expect(missingServerConfig({})).toHaveLength(5);
  });
});
