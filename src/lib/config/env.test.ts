// Reads server configuration, so it must run outside a browser environment.
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  MissingConfigError,
  missingServerConfig,
  readServerConfig,
} from './env';

const COMPLETE = {
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'onboarding@resend.dev',
  RECOGNITION_SECRET: 'a-secret',
  DATABASE_URL: 'postgres://localhost/safebackpack',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

describe('readServerConfig', () => {
  it('reads a complete environment', () => {
    expect(readServerConfig(COMPLETE)).toEqual({
      resendApiKey: 're_test_key',
      emailFrom: 'onboarding@resend.dev',
      recognitionSecret: 'a-secret',
      databaseUrl: 'postgres://localhost/safebackpack',
      siteUrl: 'http://localhost:3000',
    });
  });

  it('trims accidental whitespace around a pasted value', () => {
    const config = readServerConfig({
      ...COMPLETE,
      RESEND_API_KEY: '  re_test_key  ',
    });
    expect(config.resendApiKey).toBe('re_test_key');
  });

  it.each(Object.keys(COMPLETE))('fails when %s is missing', (variable) => {
    const source = { ...COMPLETE, [variable]: undefined };
    expect(() => readServerConfig(source)).toThrowError(MissingConfigError);
  });

  it.each([[''], ['   ']])('treats %p as missing, not as a value', (value) => {
    expect(() =>
      readServerConfig({ ...COMPLETE, RECOGNITION_SECRET: value }),
    ).toThrowError(MissingConfigError);
  });

  it('names the offending variable and how to fix it', () => {
    try {
      readServerConfig({ ...COMPLETE, DATABASE_URL: undefined });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as MissingConfigError).variable).toBe('DATABASE_URL');
      expect((error as Error).message).toContain('.env.example');
    }
  });

  it('never puts a secret value into the error message', () => {
    try {
      readServerConfig({ ...COMPLETE, EMAIL_FROM: undefined });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('re_test_key');
      expect((error as Error).message).not.toContain('a-secret');
    }
  });
});

describe('missingServerConfig', () => {
  it('is empty for a complete environment', () => {
    expect(missingServerConfig(COMPLETE)).toEqual([]);
  });

  it('lists every missing variable at once', () => {
    expect(
      missingServerConfig({
        ...COMPLETE,
        RESEND_API_KEY: undefined,
        DATABASE_URL: '',
      }),
    ).toEqual(['RESEND_API_KEY', 'DATABASE_URL']);
  });

  it('lists everything for an empty environment', () => {
    expect(missingServerConfig({})).toHaveLength(5);
  });
});
