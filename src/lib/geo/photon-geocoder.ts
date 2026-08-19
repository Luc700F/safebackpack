/**
 * Place search through Photon, OpenStreetMap's search-as-you-type geocoder.
 *
 * Called from our own endpoint, never from the browser: a public geocoder is
 * a shared resource, and going through the server lets us identify ourselves
 * honestly, cap our own traffic and change provider without touching the
 * interface.
 */

import { type Place, parsePlaces } from './places';

const ENDPOINT = 'https://photon.komoot.io/api/';
const TIMEOUT_MS = 4000;

/** Photon asks callers to identify themselves. */
const USER_AGENT = 'safebackpack/0.1 (+https://safebackpack.app)';

export interface Geocoder {
  search(query: string): Promise<Place[]>;
}

export interface PhotonOptions {
  /** Injectable so tests never reach the network. */
  fetchImpl?: typeof fetch;
}

export class PhotonGeocoder implements Geocoder {
  private readonly fetchImpl: typeof fetch;

  constructor(options: PhotonOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Returns an empty list rather than throwing when the geocoder is slow,
   * unreachable or unhappy. Somebody halfway through writing a report should
   * see "no suggestions", not an error.
   */
  async search(query: string): Promise<Place[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '6');
    // Ask for English names, so results read the same as the rest of the site.
    url.searchParams.set('lang', 'en');

    try {
      const response = await this.fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return [];

      return parsePlaces(await response.json());
    } catch {
      return [];
    }
  }
}

/** A geocoder with fixed answers, for tests. */
export class StaticGeocoder implements Geocoder {
  private readonly places: Place[];

  constructor(places: Place[] = []) {
    this.places = places;
  }

  async search(): Promise<Place[]> {
    return this.places;
  }
}
