import { describe, expect, it } from 'vitest';

import { MIN_QUERY_LENGTH, isSearchableQuery, parsePlaces } from './places';

function feature(overrides: Record<string, unknown> = {}) {
  return {
    geometry: { coordinates: [100.5018, 13.7563] },
    properties: {
      osm_type: 'R',
      osm_id: 123,
      name: 'Bangkok',
      state: 'Bangkok',
      country: 'Thailand',
      countrycode: 'th',
      ...overrides,
    },
  };
}

describe('parsePlaces', () => {
  it('reads coordinates longitude first, as GeoJSON gives them', () => {
    const [place] = parsePlaces({ features: [feature()] });

    expect(place.latitude).toBe(13.7563);
    expect(place.longitude).toBe(100.5018);
  });

  it('builds one readable line', () => {
    const [place] = parsePlaces({
      features: [feature({ name: 'Chiang Mai', state: 'Chiang Mai Province' })],
    });

    expect(place.label).toBe('Chiang Mai, Chiang Mai Province, Thailand');
  });

  it('does not repeat a name that appears at several levels', () => {
    const [place] = parsePlaces({ features: [feature()] });

    expect(place.label).toBe('Bangkok, Thailand');
  });

  it('uppercases the country code', () => {
    expect(parsePlaces({ features: [feature()] })[0].countryCode).toBe('TH');
  });

  it('leaves the country code null when the provider has none', () => {
    const [place] = parsePlaces({
      features: [feature({ countrycode: undefined })],
    });

    expect(place.countryCode).toBeNull();
  });

  it('rejects a country code that is not two letters', () => {
    const [place] = parsePlaces({ features: [feature({ countrycode: 'xyz' })] });

    expect(place.countryCode).toBeNull();
  });

  it('caps the number of suggestions', () => {
    const many = Array.from({ length: 20 }, () => feature());

    expect(parsePlaces({ features: many }).length).toBeLessThanOrEqual(6);
  });

  it.each([
    [{ geometry: { coordinates: [200, 0] } }],
    [{ geometry: { coordinates: [0, 91] } }],
    [{ geometry: { coordinates: ['a', 'b'] } }],
    [{ geometry: { coordinates: [1] } }],
    [{ geometry: {} }],
    [{}],
  ])('skips the malformed feature %p rather than failing', (broken) => {
    const places = parsePlaces({
      features: [broken, feature()],
    });

    expect(places).toHaveLength(1);
    expect(places[0].label).toBe('Bangkok, Thailand');
  });

  it('skips a feature with no usable name', () => {
    expect(
      parsePlaces({
        features: [
          {
            geometry: { coordinates: [1, 1] },
            properties: { osm_id: 1 },
          },
        ],
      }),
    ).toEqual([]);
  });

  it.each([[null], [undefined], [42], ['text'], [{}], [{ features: 'no' }]])(
    'returns nothing for the malformed payload %p',
    (payload) => {
      expect(parsePlaces(payload)).toEqual([]);
    },
  );

  it('gives each suggestion its own key', () => {
    const places = parsePlaces({
      features: [feature(), feature(), feature()],
    });

    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
  });
});

describe('isSearchableQuery', () => {
  it('accepts a query of the minimum length', () => {
    expect(isSearchableQuery('a'.repeat(MIN_QUERY_LENGTH))).toBe(true);
  });

  it.each([[''], ['ab'], ['  a  '], [null], [undefined], [42]])(
    'rejects %p as too short to search',
    (query) => {
      expect(isSearchableQuery(query)).toBe(false);
    },
  );
});
