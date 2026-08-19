/**
 * Plausible reports for looking at the map during development.
 *
 *   npm run db:seed-demo            insert them
 *   npm run db:seed-demo -- --clear remove them again
 *
 * Every seeded row carries a marker in its email hash, so removing them can
 * never touch a real report. These are invented incidents: they must never
 * reach a database anybody relies on.
 */

import { readFileSync } from 'node:fs';

import postgres from 'postgres';

/** Marks a row as seeded. A real hash is an HMAC and cannot start with this. */
const DEMO_MARKER = 'de11de11';

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
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return values;
}

interface Demo {
  category: string;
  /** Required by the database for the free-text category, forbidden otherwise. */
  customLabel?: string;
  timeOfDay: 'day' | 'evening' | 'night';
  latitude: number;
  longitude: number;
  country: string;
  name: string | null;
  home: string;
  daysAgo: number;
  confirmations: number;
  description: string;
}

const DEMOS: Demo[] = [
  { category: 'theft', timeOfDay: 'night', latitude: 13.7563, longitude: 100.5018, country: 'TH', name: 'Mara', home: 'DE', daysAgo: 3, confirmations: 2, description: 'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river. Keep bags on the wall side of the pavement.' },
  { category: 'scam', timeOfDay: 'day', latitude: 13.7515, longitude: 100.4927, country: 'TH', name: 'Jonas', home: 'CH', daysAgo: 11, confirmations: 4, description: 'A friendly man outside the palace said it was closed for a ceremony and offered a tuk-tuk tour instead. The palace was open. The tour ends at a tailor shop.' },
  { category: 'theft', timeOfDay: 'day', latitude: 13.7443, longitude: 100.5342, country: 'TH', name: null, home: 'NL', daysAgo: 25, confirmations: 0, description: 'Phone taken from a table on a busy terrace while I was looking at the menu. It happened in seconds and nobody noticed.' },
  { category: 'natural-hazard', timeOfDay: 'day', latitude: 18.7883, longitude: 98.9853, country: 'TH', name: 'Ana', home: 'ES', daysAgo: 6, confirmations: 3, description: 'The mountain road north of the city is partly washed out after heavy rain. Passable on foot, not with a scooter.' },
  { category: 'robbery', timeOfDay: 'night', latitude: -12.0464, longitude: -77.0428, country: 'PE', name: 'Tom', home: 'GB', daysAgo: 8, confirmations: 1, description: 'Threatened with a knife on a quiet street two blocks from the main square, just after midnight. Handed over the phone and it ended there.' },
  { category: 'scam', timeOfDay: 'evening', latitude: -12.1219, longitude: -77.0297, country: 'PE', name: 'Lena', home: 'AT', daysAgo: 19, confirmations: 2, description: 'Taxi driver claimed the meter was broken and asked for five times the normal fare once we had arrived. Agree the price before getting in.' },
  { category: 'unrest', timeOfDay: 'day', latitude: -33.4489, longitude: -70.6693, country: 'CL', name: 'Pablo', home: 'FR', daysAgo: 2, confirmations: 6, description: 'Large demonstration around the main avenue. Peaceful but the metro stations nearby were closed without warning.' },
  { category: 'harassment', timeOfDay: 'night', latitude: 41.0082, longitude: 28.9784, country: 'TR', name: null, home: 'SE', daysAgo: 14, confirmations: 3, description: 'Followed for several streets after leaving a bar alone. Going into a lit shop and waiting worked; the person left.' },
  { category: 'theft', timeOfDay: 'day', latitude: 41.3874, longitude: 2.1686, country: 'ES', name: 'Fabio', home: 'IT', daysAgo: 30, confirmations: 5, description: 'Classic distraction on the main pedestrian street: someone asks for directions while another opens the backpack behind you.' },
  { category: 'theft', timeOfDay: 'evening', latitude: 41.3809, longitude: 2.1728, country: 'ES', name: 'Nora', home: 'CH', daysAgo: 41, confirmations: 1, description: 'Wallet lifted on a crowded metro line towards the beach. Front pockets only on that line.' },
  { category: 'scam', timeOfDay: 'day', latitude: 48.8584, longitude: 2.2945, country: 'FR', name: 'Ines', home: 'PT', daysAgo: 22, confirmations: 2, description: 'Petition signers around the tower, working in groups. While you read the clipboard someone goes through your bag.' },
  { category: 'natural-hazard', timeOfDay: 'day', latitude: -8.4095, longitude: 115.1889, country: 'ID', name: 'Sven', home: 'DK', daysAgo: 5, confirmations: 4, description: 'Strong rip currents on the west coast beaches this week. Two rescues while we were there, no flags on the beach.' },
  { category: 'other', customLabel: 'Aggressive stray dogs', timeOfDay: 'night', latitude: 27.7172, longitude: 85.324, country: 'NP', name: 'Kiran', home: 'IN', daysAgo: 16, confirmations: 0, description: 'Packs of stray dogs get aggressive around the ring road after dark. Walking with a stick or taking a taxi is worth it.' },
  { category: 'robbery', timeOfDay: 'night', latitude: -22.9711, longitude: -43.1822, country: 'BR', name: null, home: 'US', daysAgo: 9, confirmations: 3, description: 'Phone snatched from my hand while walking along the beachfront path at night. Do not walk with the phone out there.' },
  { category: 'unrest', timeOfDay: 'evening', latitude: 4.711, longitude: -74.0721, country: 'CO', name: 'Diego', home: 'MX', daysAgo: 4, confirmations: 2, description: 'Roadblocks north of the centre during a strike. Buses stopped running with no announcement; walking was the only way back.' },
];

function demoHash(index: number): string {
  return DEMO_MARKER + String(index).padStart(56, '0');
}

async function main(): Promise<void> {
  const env = { ...loadEnvFile('.env.local'), ...process.env };
  if (!env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Fill it in in .env.local.');
    process.exit(1);
  }

  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });

  try {
    if (process.argv.includes('--clear')) {
      const removed = await sql`
        delete from reports
        where reporter_email_hash like ${`${DEMO_MARKER}%`}
        returning id
      `;
      console.log(`Removed ${removed.length} demo reports.`);
      return;
    }

    await sql`delete from reports where reporter_email_hash like ${`${DEMO_MARKER}%`}`;

    for (const [index, demo] of DEMOS.entries()) {
      const published = new Date(Date.now() - demo.daysAgo * 86_400_000);
      // 90 days plus 30 per confirmation, capped at 180. Kept in step with
      // src/lib/reports/retention.ts.
      const lifetime = Math.min(90 + demo.confirmations * 30, 180);
      const expires = new Date(published.getTime() + lifetime * 86_400_000);

      // Displaced roughly the way the application displaces a real position.
      const offset = () => (Math.random() - 0.5) * 0.0018;

      await sql`
        insert into reports (
          status, category, custom_category_label, description, time_of_day,
          position, public_position, country_code,
          reporter_first_name, reporter_home_country, publish_anonymously,
          reporter_email_hash,
          occurred_at, created_at, published_at, expires_at, confirmation_count
        ) values (
          'published', ${demo.category}, ${demo.customLabel ?? null},
          ${demo.description}, ${demo.timeOfDay},
          st_setsrid(st_makepoint(${demo.longitude}, ${demo.latitude}), 4326)::geography,
          st_setsrid(st_makepoint(${demo.longitude + offset()}, ${demo.latitude + offset()}), 4326)::geography,
          ${demo.country},
          ${demo.name}, ${demo.home}, ${demo.name === null},
          ${demoHash(index)},
          ${published}, ${published}, ${published}, ${expires}, ${demo.confirmations}
        )
      `;
    }

    console.log(`Inserted ${DEMOS.length} demo reports.`);
    console.log('Remove them again with: npm run db:seed-demo -- --clear');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
