// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { PhotonGeocoder, StaticGeocoder } from './photon-geocoder';

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

const RESULT = {
  features: [
    {
      geometry: { coordinates: [100.5018, 13.7563] },
      properties: {
        osm_type: 'R',
        osm_id: 1,
        name: 'Bangkok',
        country: 'Thailand',
        countrycode: 'th',
      },
    },
  ],
};

describe('PhotonGeocoder', () => {
  it('returns the places the provider found', async () => {
    const fetchImpl = vi.fn(async () => ok(RESULT));
    const places = await new PhotonGeocoder({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).search('bangkok');

    expect(places).toHaveLength(1);
    expect(places[0].label).toBe('Bangkok, Thailand');
  });

  it('sends the query, a result cap and a language', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL) => ok(RESULT));
    await new PhotonGeocoder({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).search('bang kok');

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get('q')).toBe('bang kok');
    expect(url.searchParams.get('limit')).toBe('6');
    expect(url.searchParams.get('lang')).toBe('en');
  });

  it('identifies itself, as the provider asks callers to', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => ok(RESULT),
    );
    await new PhotonGeocoder({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).search('bangkok');

    const headers = fetchImpl.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('safebackpack');
  });

  it('returns nothing when the provider errors', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));

    await expect(
      new PhotonGeocoder({
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).search('bangkok'),
    ).resolves.toEqual([]);
  });

  it('returns nothing when the provider is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(
      new PhotonGeocoder({
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).search('bangkok'),
    ).resolves.toEqual([]);
  });

  it('returns nothing when the answer is not JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>', { status: 200 }));

    await expect(
      new PhotonGeocoder({
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).search('bangkok'),
    ).resolves.toEqual([]);
  });
});

describe('StaticGeocoder', () => {
  it('answers with what it was given', async () => {
    const place = {
      id: '1',
      label: 'Bangkok, Thailand',
      latitude: 13.7563,
      longitude: 100.5018,
      countryCode: 'TH',
    };

    await expect(new StaticGeocoder([place]).search()).resolves.toEqual([place]);
  });

  it('answers with nothing by default', async () => {
    await expect(new StaticGeocoder().search()).resolves.toEqual([]);
  });
});
