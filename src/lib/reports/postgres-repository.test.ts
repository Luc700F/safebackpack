// @vitest-environment node
import { afterAll, describe, it } from 'vitest';

import { closeSql, getSql } from '../db/client';
import { PostgresReportRepository } from './postgres-repository';
import { describeReportRepository } from './repository-contract';

/**
 * Runs the shared repository contract against a real database.
 *
 * Skipped when DATABASE_URL is absent, so the suite stays runnable on a
 * machine with no database — but the moment one is configured, the Postgres
 * store must satisfy exactly what the in-memory one does.
 */
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  describe('PostgresReportRepository', () => {
    it.skip('needs DATABASE_URL to run', () => undefined);
  });
} else {
  const sql = getSql();
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
