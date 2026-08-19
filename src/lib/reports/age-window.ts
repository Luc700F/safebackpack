/**
 * "How recent?" filter for the map and the list view.
 *
 * Windows are expressed in whole days rather than calendar months so that the
 * result never depends on which month the visitor happens to be looking at.
 * The widest window matches the retention period, so "past 6 months" is
 * always everything we still hold.
 */

import { RETENTION_DAYS } from './retention';

export type AgeWindowId = '1d' | '7d' | '30d' | '90d' | '180d';

export interface AgeWindow {
  id: AgeWindowId;
  label: string;
  days: number;
}

export const AGE_WINDOWS: readonly AgeWindow[] = [
  { id: '1d', label: 'Past 24 hours', days: 1 },
  { id: '7d', label: 'Past week', days: 7 },
  { id: '30d', label: 'Past month', days: 30 },
  { id: '90d', label: 'Past 3 months', days: 90 },
  { id: '180d', label: 'Past 6 months', days: RETENTION_DAYS },
];

export const DEFAULT_AGE_WINDOW: AgeWindowId = '90d';

const WINDOWS_BY_ID = new Map<string, AgeWindow>(
  AGE_WINDOWS.map((window) => [window.id, window]),
);

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function isAgeWindowId(value: unknown): value is AgeWindowId {
  return typeof value === 'string' && WINDOWS_BY_ID.has(value);
}

/**
 * Reads a window id coming from an URL query string. Anything unrecognised
 * falls back to the default rather than throwing, so a hand-edited or stale
 * link still renders a sensible map.
 */
export function parseAgeWindow(value: unknown): AgeWindowId {
  return isAgeWindowId(value) ? value : DEFAULT_AGE_WINDOW;
}

/** The oldest publication timestamp still included by the given window. */
export function ageWindowStart(id: AgeWindowId, now: Date): Date {
  const window = WINDOWS_BY_ID.get(id);
  if (!window) {
    throw new Error(`Unknown age window: ${id}`);
  }

  return new Date(now.getTime() - window.days * MILLISECONDS_PER_DAY);
}

export function isWithinAgeWindow(
  publishedAt: Date,
  id: AgeWindowId,
  now: Date,
): boolean {
  const start = ageWindowStart(id, now);
  return publishedAt.getTime() >= start.getTime() && publishedAt.getTime() <= now.getTime();
}
