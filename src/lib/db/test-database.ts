/**
 * The connection the database tests are allowed to use.
 *
 * These tests empty tables between cases, so pointing them at a database
 * anybody relies on destroys its contents. That has happened once already.
 *
 * So they run only against `TEST_DATABASE_URL`, and refuse outright if it is
 * the same database as `DATABASE_URL`. Absent, the tests skip themselves,
 * which keeps `npm run verify` runnable on a machine with no database at all.
 */

export class UnsafeTestDatabaseError extends Error {
  constructor() {
    super(
      'TEST_DATABASE_URL points at the same database as DATABASE_URL. ' +
        'These tests delete rows; they need a database of their own.',
    );
    this.name = 'UnsafeTestDatabaseError';
  }
}

/**
 * Returns the test connection string, or null when none is configured.
 * Throws when the configured one is the production database.
 */
export function readTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const testUrl = env.TEST_DATABASE_URL?.trim();
  if (!testUrl) return null;

  const productionUrl = env.DATABASE_URL?.trim();
  if (productionUrl && isSameDatabase(testUrl, productionUrl)) {
    throw new UnsafeTestDatabaseError();
  }

  return testUrl;
}

/**
 * Same host, port and database name means the same data, whatever else
 * differs — a different user or pooling mode is not a different database.
 */
export function isSameDatabase(a: string, b: string): boolean {
  try {
    const first = new URL(a);
    const second = new URL(b);

    return (
      first.hostname === second.hostname &&
      (first.port || '5432') === (second.port || '5432') &&
      first.pathname === second.pathname
    );
  } catch {
    // Unparseable: assume the worst rather than allow a destructive run.
    return true;
  }
}
