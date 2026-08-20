// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  UnsafeTestDatabaseError,
  isSameDatabase,
  readTestDatabaseUrl,
} from './test-database';

const PRODUCTION = 'postgresql://user:pw@db.example.com:5432/postgres';
const SEPARATE = 'postgresql://user:pw@db.example.com:5432/safebackpack_test';

describe('readTestDatabaseUrl', () => {
  it('returns the test connection when it is a different database', () => {
    expect(
      readTestDatabaseUrl({
        DATABASE_URL: PRODUCTION,
        TEST_DATABASE_URL: SEPARATE,
      }),
    ).toBe(SEPARATE);
  });

  it('returns null when no test database is configured', () => {
    expect(readTestDatabaseUrl({ DATABASE_URL: PRODUCTION })).toBeNull();
  });

  it('refuses when it is the very same connection string', () => {
    expect(() =>
      readTestDatabaseUrl({
        DATABASE_URL: PRODUCTION,
        TEST_DATABASE_URL: PRODUCTION,
      }),
    ).toThrowError(UnsafeTestDatabaseError);
  });

  it('refuses when only the credentials differ', () => {
    expect(() =>
      readTestDatabaseUrl({
        DATABASE_URL: PRODUCTION,
        TEST_DATABASE_URL: 'postgresql://other:secret@db.example.com:5432/postgres',
      }),
    ).toThrowError(UnsafeTestDatabaseError);
  });

  it('allows a test database when nothing else is configured', () => {
    expect(readTestDatabaseUrl({ TEST_DATABASE_URL: SEPARATE })).toBe(SEPARATE);
  });

  it('says in the message why it refused', () => {
    try {
      readTestDatabaseUrl({
        DATABASE_URL: PRODUCTION,
        TEST_DATABASE_URL: PRODUCTION,
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).toMatch(/delete rows/);
    }
  });
});

describe('isSameDatabase', () => {
  it('sees the same host, port and database as the same', () => {
    expect(isSameDatabase(PRODUCTION, PRODUCTION)).toBe(true);
  });

  it('treats a missing port as the default one', () => {
    expect(
      isSameDatabase(
        'postgresql://u:p@host/postgres',
        'postgresql://u:p@host:5432/postgres',
      ),
    ).toBe(true);
  });

  it('sees a different database name as different', () => {
    expect(isSameDatabase(PRODUCTION, SEPARATE)).toBe(false);
  });

  it('sees a different host as different', () => {
    expect(
      isSameDatabase(PRODUCTION, 'postgresql://u:p@other.example.com:5432/postgres'),
    ).toBe(false);
  });

  it.each([['not a url', PRODUCTION], [PRODUCTION, ''], ['', '']])(
    'assumes the worst for unparseable input (%p, %p)',
    (a, b) => {
      expect(isSameDatabase(a, b)).toBe(true);
    },
  );
});
