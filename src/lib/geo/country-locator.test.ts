// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { StaticCountryLocator } from './country-locator';

describe('StaticCountryLocator', () => {
  it('returns the code it was configured with', async () => {
    await expect(
      new StaticCountryLocator('TH').locate({
        latitude: 13.7563,
        longitude: 100.5018,
      }),
    ).resolves.toBe('TH');
  });

  it('can stand in for a position that belongs to no country', async () => {
    await expect(
      new StaticCountryLocator(null).locate({ latitude: 0, longitude: -160 }),
    ).resolves.toBeNull();
  });
});
