/**
 * The database connection.
 *
 * One pool for the process, created on first use. Serverless functions are
 * short-lived and numerous, so the pool is deliberately small: many functions
 * each holding many connections is the usual way to exhaust a Postgres
 * instance.
 */

import postgres from 'postgres';

import { readDatabaseConfig } from '../config/env';

export type Sql = postgres.Sql;

let sql: Sql | null = null;

export function getSql(): Sql {
  if (sql) return sql;

  sql = postgres(readDatabaseConfig().url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    // Statements can reach logs and error trackers; never let a value be
    // interpolated into one by accident.
    prepare: false,
  });

  return sql;
}

/** Closes the pool. For tests and for a graceful shutdown. */
export async function closeSql(): Promise<void> {
  if (!sql) return;

  const closing = sql;
  sql = null;
  await closing.end({ timeout: 5 });
}
