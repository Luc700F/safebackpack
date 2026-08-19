import { describe, expect, it } from 'vitest';

import { searchCountries } from './country-search';

describe('searchCountries', () => {
  it('finds a country by its full name', () => {
    expect(searchCountries('Thailand')[0]).toEqual({
      code: 'TH',
      name: 'Thailand',
    });
  });

  it('finds a country by the start of its name', () => {
    expect(searchCountries('switz')[0].code).toBe('CH');
  });

  it('ignores case', () => {
    expect(searchCountries('BRAZIL')[0].code).toBe('BR');
  });

  it('prefers a name that starts with the query over one that contains it', () => {
    const names = searchCountries('ind').map((match) => match.name);

    expect(names[0]).toBe('India');
    expect(names).toContain('Indonesia');
  });

  it('still finds a country matched in the middle of its name', () => {
    expect(searchCountries('herlands').map((m) => m.code)).toContain('NL');
  });

  it('returns a handful at most', () => {
    expect(searchCountries('a').length).toBeLessThanOrEqual(4);
    expect(searchCountries('an').length).toBeLessThanOrEqual(4);
  });

  it.each([[''], ['a'], ['   ']])(
    'returns nothing for %p, which is too short to mean anything',
    (query) => {
      expect(searchCountries(query)).toEqual([]);
    },
  );

  it('returns nothing when nothing matches', () => {
    expect(searchCountries('zzzzzz')).toEqual([]);
  });
});
