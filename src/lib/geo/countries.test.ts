import { describe, expect, it } from 'vitest';

import {
  COUNTRY_CODES,
  countryName,
  countryOptions,
  isCountryCode,
} from './countries';

describe('COUNTRY_CODES', () => {
  it('holds the full ISO 3166-1 alpha-2 set', () => {
    expect(COUNTRY_CODES.length).toBe(249);
  });

  it('lists every code exactly once', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('uses two uppercase letters throughout', () => {
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('cannot be mutated by a caller', () => {
    expect(() => (COUNTRY_CODES as string[]).push('XX')).toThrow();
  });
});

describe('isCountryCode', () => {
  it.each([['CH'], ['TH'], ['US']])('accepts %s', (code) => {
    expect(isCountryCode(code)).toBe(true);
  });

  it.each([['ch'], ['CHE'], ['XX'], [''], [null], [undefined], [42]])(
    'rejects %p',
    (value) => {
      expect(isCountryCode(value)).toBe(false);
    },
  );
});

describe('countryName', () => {
  it('resolves a code to its English name', () => {
    expect(countryName('CH')).toBe('Switzerland');
    expect(countryName('TH')).toBe('Thailand');
  });

  it('throws on an unknown code rather than echoing it back', () => {
    expect(() => countryName('XX')).toThrowError(/Unknown country code/);
  });
});

describe('countryOptions', () => {
  it('returns one option per country', () => {
    expect(countryOptions()).toHaveLength(COUNTRY_CODES.length);
  });

  it('sorts by name so a select element reads correctly', () => {
    const names = countryOptions().map((option) => option.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('gives every option a code and a non-empty name', () => {
    for (const option of countryOptions()) {
      expect(option.code).toMatch(/^[A-Z]{2}$/);
      expect(option.name.length).toBeGreaterThan(0);
    }
  });
});
