/**
 * Coordinate handling, including the privacy fuzzing applied before a report
 * is ever shown publicly.
 *
 * The exact position a reporter picked is kept only in the database. Everything
 * that leaves the server carries a deliberately displaced position, so a report
 * cannot point at somebody's hotel room, workplace or home.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

/** How far a public position is displaced from the real one, in metres. */
export const FUZZ_RADIUS_METRES = 100;

const EARTH_RADIUS_METRES = 6_371_000;

export function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_LATITUDE &&
    value <= MAX_LATITUDE
  );
}

export function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_LONGITUDE &&
    value <= MAX_LONGITUDE
  );
}

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Coordinates>;
  return (
    isValidLatitude(candidate.latitude) && isValidLongitude(candidate.longitude)
  );
}

/**
 * Displaces a position by a random offset of up to `FUZZ_RADIUS_METRES`.
 *
 * The offset is drawn fresh each time and is never stored, so repeated views
 * of the same report cannot be averaged back to the true position — the server
 * fuzzes once, when the report is published, and keeps that result.
 *
 * `random` is injectable so tests can pin the outcome.
 */
export function fuzzCoordinates(
  position: Coordinates,
  random: () => number = Math.random,
): Coordinates {
  // Square root keeps the draw uniform over the disc rather than clustering
  // it near the centre.
  const distance = FUZZ_RADIUS_METRES * Math.sqrt(random());
  const bearing = 2 * Math.PI * random();

  const latitudeOffset = (distance * Math.cos(bearing)) / EARTH_RADIUS_METRES;
  const longitudeOffset =
    (distance * Math.sin(bearing)) /
    (EARTH_RADIUS_METRES * Math.cos(toRadians(position.latitude)));

  return {
    latitude: clamp(
      position.latitude + toDegrees(latitudeOffset),
      MIN_LATITUDE,
      MAX_LATITUDE,
    ),
    longitude: wrapLongitude(position.longitude + toDegrees(longitudeOffset)),
  };
}

/** Great-circle distance between two positions, in metres. */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keeps a longitude inside -180..180 after an offset crosses the date line. */
export function wrapLongitude(longitude: number): number {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}
