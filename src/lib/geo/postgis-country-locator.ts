/**
 * Country lookup as a single indexed database query.
 *
 * Boundaries are land only, so a report from a pier, a beach edge or a ferry
 * would fall outside every shape. Rather than refusing those, the query takes
 * the nearest country within a short distance: a point inside a country is at
 * distance zero and always wins, and a point just offshore is attributed to
 * the coast it belongs to. Far out at sea nothing is within reach and the
 * answer is honestly "no country".
 */

import type { Sql } from '../db/client';
import type { Coordinates } from './coordinates';
import type { CountryLocator } from './country-locator';

/** How far offshore a position may be and still belong to the coast, in metres. */
export const COASTAL_TOLERANCE_METRES = 25_000;

export class PostgisCountryLocator implements CountryLocator {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async locate(position: Coordinates): Promise<string | null> {
    const [row] = await this.sql<{ code: string }[]>`
      with point as (
        select st_setsrid(
          st_makepoint(${position.longitude}, ${position.latitude}),
          4326
        )::geography as g
      )
      select countries.code
      from countries, point
      where st_dwithin(countries.boundary, point.g, ${COASTAL_TOLERANCE_METRES})
      order by st_distance(countries.boundary, point.g)
      limit 1
    `;

    return row?.code.trim() ?? null;
  }
}
