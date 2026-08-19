/**
 * Finding a country by what somebody types.
 *
 * Runs in the browser against the country list we already ship, so choosing
 * "Thailand" costs no request and no waiting. Place search goes to the
 * geocoder; countries do not need to.
 */

import { countryOptions } from './countries';

export interface CountryMatch {
  code: string;
  name: string;
}

const MAX_MATCHES = 4;

/**
 * Matches a name starting with the query first, then names containing it, so
 * "ind" offers India before Finland.
 */
export function searchCountries(query: string): CountryMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const starts: CountryMatch[] = [];
  const contains: CountryMatch[] = [];

  for (const country of countryOptions()) {
    const name = country.name.toLowerCase();

    if (name.startsWith(needle)) {
      starts.push(country);
    } else if (name.includes(needle)) {
      contains.push(country);
    }

    if (starts.length >= MAX_MATCHES) break;
  }

  return [...starts, ...contains].slice(0, MAX_MATCHES);
}
