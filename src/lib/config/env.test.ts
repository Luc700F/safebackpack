// Reads server configuration, so it must run outside a browser environment.
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  MissingConfigError,
  hasDatabaseConfig,
  hasEmailConfig,
  missingServerConfig,
  readDatabaseConfig,
  readEmailConfig,
  readSigningConfig,
} from './env';

const COMPLETE = {
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'onboarding@resend.dev',
  RECOGNITION_SECRET: 'a-secret',
  DATABASE_URL: 'postgres://localhost/safebackpack',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

describe('readSigningConfig', () => {
  it('reads the secret and the site origin', () => {
    expect(readSigningConfig(COMPLETE)).toEqual({
      secret: 'a-secret',
      siteUrl: 'http://localhost:3000',
    });
  });

  it('trims accidental whitespace around a pasted value', () => {
    expect(
      readSigningConfig({ ...COMPLETE, RECOGNITION_SECRET: '  a-secret  ' })
        .secret,
    ).toBe('a-secret');
  });

  it.each(['RECOGNITION_SECRET', 'NEXT_PUBLIC_SITE_URL'])(
    'fails when %s is missing',
    (variable) => {
      expect(() =>
        readSigningConfig({ ...COMPLETE, [variable]: undefined }),
      ).toThrowError(MissingConfigError);
    },
  );

  it('does not care whether a database is configured', () => {
    expect(() =>
      readSigningConfig({ ...COMPLETE, DATABASE_URL: undefined }),
    ).not.toThrow();
  });
});

describe('readEmailConfig', () => {
  it('reads the key and the sending address', () => {
    expect(readEmailConfig(COMPLETE)).toEqual({
      apiKey: 're_test_key',
      from: 'onboarding@resend.dev',
    });
  });

  it.each(['RESEND_API_KEY', 'EMAIL_FROM'])(
    'fails when %s is missing',
    (variable) => {
      expect(() =>
        readEmailConfig({ ...COMPLETE, [variable]: undefined }),
      ).toThrowError(MissingConfigError);
    },
  );
});

describe('readDatabaseConfig', () => {
  it('reads the connection string', () => {
    expect(readDatabaseConfig(COMPLETE).url).toBe(
      'postgres://localhost/safebackpack',
    );
  });

  it('fails by name when it is missing', () => {
    try {
      readDatabaseConfig({ ...COMPLETE, DATABASE_URL: undefined });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as MissingConfigError).variable).toBe('DATABASE_URL');
      expect((error as Error).message).toContain('.env.example');
    }
  });
});

describe('treating blanks as absent', () => {
  it.each([[''], ['   ']])('rejects %p as a value', (value) => {
    expect(() =>
      readSigningConfig({ ...COMPLETE, RECOGNITION_SECRET: value }),
    ).toThrowError(MissingConfigError);
  });
});

describe('secrecy of failures', () => {
  it('never puts a secret value into the error message', () => {
    try {
      readEmailConfig({ ...COMPLETE, EMAIL_FROM: undefined });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('re_test_key');
      expect((error as Error).message).not.toContain('a-secret');
    }
  });
});

describe('availability checks', () => {
  it('reports email as available only when both variables are set', () => {
    expect(hasEmailConfig(COMPLETE)).toBe(true);
    expect(hasEmailConfig({ ...COMPLETE, RESEND_API_KEY: '' })).toBe(false);
    expect(hasEmailConfig({ ...COMPLETE, EMAIL_FROM: undefined })).toBe(false);
  });

  it('reports the database as available only when configured', () => {
    expect(hasDatabaseConfig(COMPLETE)).toBe(true);
    expect(hasDatabaseConfig({})).toBe(false);
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
