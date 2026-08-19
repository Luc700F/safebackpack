/**
 * When during the day an incident happened.
 *
 * Travellers care far more about "this street is fine by day and not after
 * dark" than about an exact clock time, and three coarse buckets cannot be
 * combined with a place and a date to single out one person the way a precise
 * timestamp could.
 *
 * The bucket is derived from the reporter's **local** hour, captured in the
 * browser. Deriving it server-side from a UTC timestamp would mislabel every
 * report filed outside the server's timezone.
 */

export type TimeOfDayId = 'day' | 'evening' | 'night';

export interface TimeOfDay {
  id: TimeOfDayId;
  label: string;
  /** First hour of the bucket, inclusive, in 24-hour local time. */
  startHour: number;
  /** First hour after the bucket, exclusive. */
  endHour: number;
}

export const TIMES_OF_DAY: readonly TimeOfDay[] = [
  { id: 'day', label: 'Daytime (06:00–18:00)', startHour: 6, endHour: 18 },
  { id: 'evening', label: 'Evening (18:00–21:00)', startHour: 18, endHour: 21 },
  // Wraps past midnight, so endHour is smaller than startHour.
  { id: 'night', label: 'Night (21:00–06:00)', startHour: 21, endHour: 6 },
];

const TIMES_BY_ID = new Map<string, TimeOfDay>(
  TIMES_OF_DAY.map((time) => [time.id, time]),
);

export function isTimeOfDayId(value: unknown): value is TimeOfDayId {
  return typeof value === 'string' && TIMES_BY_ID.has(value);
}

/**
 * Maps a local hour (0–23) onto its bucket.
 * Throws on anything that is not a whole hour in range, because a bad value
 * here would silently mislabel a report rather than fail visibly.
 */
export function timeOfDayFromHour(hour: number): TimeOfDayId {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Not an hour of the day: ${hour}`);
  }

  if (hour >= 6 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

/** Reads the bucket off a date, using that date's local hour. */
export function timeOfDayOf(date: Date): TimeOfDayId {
  return timeOfDayFromHour(date.getHours());
}

export function timeOfDayLabel(id: TimeOfDayId): string {
  const time = TIMES_BY_ID.get(id);
  if (!time) {
    throw new Error(`Unknown time of day: ${id}`);
  }

  return time.label;
}
