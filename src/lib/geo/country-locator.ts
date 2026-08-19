/**
 * Which country a position falls in.
 *
 * Derived on the server from the coordinates, never taken from the client: a
 * report's country decides which map and which statistics it appears in, so a
 * client must not be able to choose it.
 *
 * The real implementation runs the point-in-polygon test in PostGIS against a
 * `countries` table with a spatial index. Doing it in Node would mean bundling
 * a 36 MB boundary dataset into every serverless function and rebuilding its
 * index on every cold start; the database already holds the geometry and can
 * answer this with one indexed query.
 */

import type { Coordinates } from './coordinates';

export interface CountryLocator {
  /**
   * ISO 3166-1 alpha-2 code, or `null` when the position is outside every
   * boundary — the open ocean, for instance.
   */
  locate(position: Coordinates): Promise<string | null>;
}

/** A locator with a fixed answer. For tests and local development. */
export class StaticCountryLocator implements CountryLocator {
  private readonly code: string | null;

  constructor(code: string | null) {
    this.code = code;
  }

  // Takes the position it ignores, so it is interchangeable with the real one.
  async locate(_position: Coordinates): Promise<string | null> {
    return this.code;
  }
}
