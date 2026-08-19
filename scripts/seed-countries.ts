/**
 * Loads country boundaries into the database.
 *
 *   npm run db:seed-countries
 *
 * Replaces whatever is there, so running it again is harmless and is how the
 * boundaries get updated. Rebuild the seed file itself with
 * scripts/build-country-boundaries.ts.
 */

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import postgres from 'postgres';

const SEED = 'db/seed/countries.json.gz';

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

interface CountryShape {
  code: string;
  geometry: unknown;
}

async function main(): Promise<void> {
  const env = { ...loadEnvFile('.env.local'), ...process.env };
  if (!env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Fill it in in .env.local.');
    process.exit(1);
  }

  const shapes = JSON.parse(
    gunzipSync(readFileSync(SEED)).toString('utf8'),
  ) as CountryShape[];

  const sql = postgres(env.DATABASE_URL, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  try {
    await sql.begin(async (tx) => {
      await tx`delete from countries`;

      for (const shape of shapes) {
        // ST_Multi normalises a Polygon into a MultiPolygon, so the column has
        // one shape type and queries need no special cases.
        await tx`
          insert into countries (code, boundary) values (
            ${shape.code},
            st_multi(st_geomfromgeojson(${JSON.stringify(shape.geometry)}))::geography
          )
        `;
      }
    });

    const [{ count }] = await sql<{ count: string }[]>`
      select count(*)::text as count from countries
    `;
    console.log(`Loaded ${count} country shapes.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
