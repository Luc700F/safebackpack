/**
 * Turning a typed place name into coordinates.
 *
 * Photon is an OpenStreetMap geocoder built for search-as-you-type and needs
 * no API key, which keeps another credential out of the project. Requests go
 * through our own endpoint rather than straight from the browser: that lets us
 * identify ourselves properly, rate-limit our own traffic, and swap the
 * provider later without touching a single component.
 *
 * The parsing is a pure function so the shape of somebody else's API is pinned
 * by tests rather than discovered in production.
 */

export interface Place {
  /** Stable within one result set; used as a list key only. */
  id: string;
  /** One readable line, e.g. "Chiang Mai, Thailand". */
  label: string;
  latitude: number;
  longitude: number;
  /** ISO 3166-1 alpha-2, when the provider knows it. */
  countryCode: string | null;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

const MAX_RESULTS = 6;

/**
 * Reads Photon's answer. Anything malformed is skipped rather than thrown:
 * a geocoder having a bad day should degrade to "no suggestions", not to an
 * error page in the middle of writing a report.
 */
export function parsePlaces(payload: unknown): Place[] {
  const features = (payload as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];

  const places: Place[] = [];

  for (const [index, feature] of features.entries()) {
    const place = toPlace(feature as PhotonFeature, index);
    if (place) places.push(place);
    if (places.length >= MAX_RESULTS) break;
  }

  return places;
}

function toPlace(feature: PhotonFeature, index: number): Place | null {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const [longitude, latitude] = coordinates;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  const properties = feature.properties ?? {};
  const label = buildLabel(properties);
  if (!label) return null;

  const countryCode = text(properties.countrycode)?.toUpperCase() ?? null;

  return {
    id: `${text(properties.osm_type) ?? 'x'}${text(properties.osm_id) ?? index}-${index}`,
    label,
    latitude,
    longitude,
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
  };
}

/**
 * Name first, then whichever administrative level adds information, then the
 * country. Duplicates are dropped so "Bangkok, Bangkok, Thailand" cannot
 * happen.
 */
function buildLabel(properties: Record<string, unknown>): string | null {
  const parts = [
    text(properties.name),
    text(properties.city) ?? text(properties.county),
    text(properties.state),
    text(properties.country),
  ];

  const seen = new Set<string>();
  const label = parts
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');

  return label.length > 0 ? label : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The shortest query worth sending to a geocoder. */
export const MIN_QUERY_LENGTH = 3;

export function isSearchableQuery(query: unknown): query is string {
  return typeof query === 'string' && query.trim().length >= MIN_QUERY_LENGTH;
}
