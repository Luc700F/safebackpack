// @vitest-environment node
import { afterAll, describe, it } from 'vitest';

import { closeSql, getSql } from '../db/client';
import { readTestDatabaseUrl } from '../db/test-database';
import { PostgresReportRepository } from './postgres-repository';
import { describeReportRepository } from './repository-contract';

/**
 * Runs the shared repository contract against a real database.
 *
 * This suite empties tables between cases, so it runs only against a database
 * of its own — see src/lib/db/test-database.ts. Without TEST_DATABASE_URL it
 * skips, which keeps the suite runnable anywhere.
 */
const databaseUrl = readTestDatabaseUrl();

if (!databaseUrl) {
  describe('PostgresReportRepository', () => {
    it.skip('needs TEST_DATABASE_URL to run', () => undefined);
  });
} else {
  const sql = getSql(databaseUrl);
  const repository = new PostgresReportRepository(sql, 'test-secret');

  describeReportRepository('PostgresReportRepository', async () => ({
    repository,
    reset: async () => {
      await sql`delete from reports`;
    },
  }));

  afterAll(async () => {
    await closeSql();
  });
}
