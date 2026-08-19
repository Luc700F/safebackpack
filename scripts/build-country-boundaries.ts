/**
 * Turns a Natural Earth country file into the compact seed in db/seed.
 *
 *   curl -sL -o /tmp/ne50.geojson \
 *     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
 *   npm run db:build-boundaries -- /tmp/ne50.geojson
 *
 * Natural Earth is in the public domain. The 1:50m scale is inherently
 * accurate to a kilometre or two, so coordinates are rounded to three decimal
 * places — about 110 m — which changes nothing about which country a point
 * falls in and cuts the file to a fraction of its size.
 *
 * Only the ISO code and the geometry are kept. Everything else in the source
 * is cartographic metadata this project has no use for.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const PRECISION = 3;
// Gzipped: coordinate lists compress to about a quarter of their size, and a
// repository should not carry a megabyte of digits it never diffs.
const OUTPUT = 'db/seed/countries.json.gz';

interface Feature {
  properties: Record<string, string>;
  geometry: { type: string; coordinates: unknown } | null;
}

function roundCoordinates(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number(value.toFixed(PRECISION));
  }

  return Array.isArray(value) ? value.map(roundCoordinates) : value;
}

function main(): void {
  const source = process.argv[2];
  if (!source) {
    console.error(
      'Usage: npm run db:build-boundaries -- <natural-earth.geojson>',
    );
    process.exit(1);
  }

  const collection = JSON.parse(readFileSync(source, 'utf8')) as {
    features: Feature[];
  };

  // Natural Earth marks unrecognised territories with -99. Their ADM0_ISO
  // still carries the state ISO assigns the territory to, which is the neutral
  // answer: a report from Northern Cyprus belongs to CY, one from Somaliland
  // to SO. Anything with no assignment at all — the Siachen Glacier — is left
  // out, and a position there is simply reported as belonging to no country.
  const alpha3ToAlpha2 = new Map<string, string>();
  for (const feature of collection.features) {
    const alpha2 = feature.properties.ISO_A2_EH;
    const alpha3 = feature.properties.ISO_A3_EH;
    if (/^[A-Z]{2}$/.test(alpha2) && /^[A-Z]{3}$/.test(alpha3)) {
      alpha3ToAlpha2.set(alpha3, alpha2);
    }
  }

  const countries: { code: string; geometry: unknown }[] = [];
  const skipped: string[] = [];

  for (const feature of collection.features) {
    if (!feature.geometry) continue;

    const direct = feature.properties.ISO_A2_EH;
    const code = /^[A-Z]{2}$/.test(direct)
      ? direct
      : alpha3ToAlpha2.get(feature.properties.ADM0_ISO);

    if (!code) {
      skipped.push(feature.properties.NAME);
      continue;
    }

    countries.push({
      code,
      geometry: {
        type: feature.geometry.type,
        coordinates: roundCoordinates(feature.geometry.coordinates),
      },
    });
  }

  writeFileSync(OUTPUT, gzipSync(JSON.stringify(countries), { level: 9 }));

  console.log(`Wrote ${countries.length} shapes to ${OUTPUT}.`);
  console.log(`Distinct countries: ${new Set(countries.map((c) => c.code)).size}`);
  if (skipped.length > 0) {
    console.log(`No ISO assignment, left out: ${skipped.join(', ')}`);
  }
}

main();
