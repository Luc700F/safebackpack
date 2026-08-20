// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';

import { closeSql, getSql } from '../db/client';
import { readTestDatabaseUrl } from '../db/test-database';
import { PostgisCountryLocator } from './postgis-country-locator';

/**
 * Runs against a database of its own — never the one the application uses.
 * See src/lib/db/test-database.ts.
 */
const databaseUrl = readTestDatabaseUrl();

if (!databaseUrl) {
  describe('PostgisCountryLocator', () => {
    it.skip('needs TEST_DATABASE_URL to run', () => undefined);
  });
} else {
  const locator = new PostgisCountryLocator(getSql(databaseUrl));

  describe('PostgisCountryLocator', () => {
    it.each([
      ['Bangkok', 13.7563, 100.5018, 'TH'],
      ['Zurich', 47.3769, 8.5417, 'CH'],
      ['Lima', -12.0464, -77.0428, 'PE'],
      ['Cape Town', -33.9249, 18.4241, 'ZA'],
      ['Reykjavik', 64.1466, -21.9426, 'IS'],
      ['Sydney', -33.8688, 151.2093, 'AU'],
      ['Anchorage', 61.2181, -149.9003, 'US'],
      ['Kathmandu', 27.7172, 85.324, 'NP'],
    ])('places %s in %s', async (_name, latitude, longitude, expected) => {
      await expect(locator.locate({ latitude, longitude })).resolves.toBe(
        expected,
      );
    });

    it('attributes a coastal position to the coast it belongs to', async () => {
      // A few hundred metres off Copacabana beach.
      await expect(
        locator.locate({ latitude: -22.9776, longitude: -43.1868 }),
      ).resolves.toBe('BR');
    });

    it('reports no country in the middle of an ocean', async () => {
      await expect(
        locator.locate({ latitude: 0, longitude: -150 }),
      ).resolves.toBeNull();
    });

    it('reports no country in the middle of the South Atlantic', async () => {
      await expect(
        locator.locate({ latitude: -30, longitude: -20 }),
      ).resolves.toBeNull();
    });

    it('answers with a bare two-letter code, not a padded one', async () => {
      const code = await locator.locate({ latitude: 47.3769, longitude: 8.5417 });
      expect(code).toMatch(/^[A-Z]{2}$/);
    });

    it('handles the poles without failing', async () => {
      await expect(
        locator.locate({ latitude: 89.9, longitude: 0 }),
      ).resolves.toBeDefined();
    });

    it('answers quickly enough to sit in a request path', async () => {
      const started = Date.now();
      await locator.locate({ latitude: 13.7563, longitude: 100.5018 });
      expect(Date.now() - started).toBeLessThan(1000);
    });

    afterAll(async () => {
      await closeSql();
    });
  });
}
