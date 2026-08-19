/**
 * Applies the SQL files in db/migrations, in filename order, once each.
 *
 *   npm run db:migrate          apply anything outstanding
 *   npm run db:migrate -- --status   list what is applied and what is not
 *
 * Applied files are recorded in `schema_migrations`, so running this twice is
 * harmless. A file that has already been applied is never re-run, which is why
 * a migration must never be edited after it has gone out — write a new one.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import postgres from 'postgres';

const MIGRATIONS_DIR = 'db/migrations';

function loadEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};

  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return values;
  }

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim();
  }

  return values;
}

interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

function readMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
      };
    });
}

async function main(): Promise<void> {
  const env = { ...loadEnvFile('.env.local'), ...process.env };
  const url = env.DATABASE_URL;

  if (!url) {
    console.error('Missing DATABASE_URL. Fill it in in .env.local.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

  try {
    await sql`
      create table if not exists schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;

    const applied = new Map(
      (
        await sql<{ name: string; checksum: string }[]>`
          select name, checksum from schema_migrations
        `
      ).map((row) => [row.name, row.checksum]),
    );

    const migrations = readMigrations();

    if (process.argv.includes('--status')) {
      for (const migration of migrations) {
        const state = applied.has(migration.name)
          ? applied.get(migration.name) === migration.checksum
            ? 'applied'
            : 'APPLIED BUT CHANGED SINCE'
          : 'pending';
        console.log(`${migration.name.padEnd(32)} ${state}`);
      }
      return;
    }

    let count = 0;
    for (const migration of migrations) {
      const previous = applied.get(migration.name);

      if (previous !== undefined) {
        if (previous !== migration.checksum) {
          // Editing an applied migration means two databases now disagree
          // about their own history. Better to stop than to guess.
          throw new Error(
            `${migration.name} was changed after it was applied. ` +
              'Write a new migration instead of editing an old one.',
          );
        }
        continue;
      }

      process.stdout.write(`applying ${migration.name} … `);
      await sql.unsafe(migration.sql);
      await sql`
        insert into schema_migrations (name, checksum)
        values (${migration.name}, ${migration.checksum})
      `;
      console.log('done');
      count += 1;
    }

    console.log(
      count === 0 ? 'Nothing to apply.' : `Applied ${count} migration(s).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
