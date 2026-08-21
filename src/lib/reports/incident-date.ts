/**
 * The calendar date an incident happened on.
 *
 * A date, never a timestamp. The precise hour is deliberately not collected —
 * see `time-of-day.ts` — and a coarse bucket plus a day plus a position moved
 * by about 100 m cannot be walked back to one person the way an exact moment
 * could. Widening this to a time would undo that on its own.
 *
 * The form fills the field in with today and most reports never touch it. It
 * exists for the traveller who had no connection until they got home, which is
 * also why it is bounded — see `incidentDateRange`.
 */

import { MAX_RETENTION_DAYS } from './retention';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD`, the format `<input type="date">` reads and writes. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * How far back a report may be dated.
 *
 * Tied to the retention ceiling rather than picked: that ceiling is the widest
 * view the map offers, so an incident older than everything the site is willing
 * to remember has no window left to be seen in.
 */
export const MAX_BACKDATE_DAYS = MAX_RETENTION_DAYS;

/**
 * The date as UTC midnight, or null when it is not a real date.
 *
 * UTC rather than local, because the value means a day on a calendar and not a
 * moment: anchoring it to midnight in whichever timezone the server happens to
 * run in would make one report show a different day in Zürich and in Bangkok.
 */
export function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;

  const match = value.match(ISO_DATE);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  // `Date.UTC` rolls overflow forward rather than refusing it: 2026-02-30
  // becomes 2 March, and a two-digit year becomes 19xx. Reading the parts back
  // is the only way to tell a real date from one that merely parsed.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Whether a value is a real calendar date written as `YYYY-MM-DD`. */
export function isCalendarDate(value: unknown): value is string {
  return parseCalendarDate(value) !== null;
}

/**
 * The calendar date a moment falls on in the reporter's own timezone.
 *
 * This is what the form offers as the default, because "today" means the day
 * the person filling in the form is living through, not the day it is in UTC.
 */
export function localCalendarDate(moment: Date): string {
  return format(moment.getFullYear(), moment.getMonth() + 1, moment.getDate());
}

/** The calendar date a moment falls on in UTC. */
export function utcCalendarDate(moment: Date): string {
  return format(
    moment.getUTCFullYear(),
    moment.getUTCMonth() + 1,
    moment.getUTCDate(),
  );
}

function format(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

/**
 * The window a reported date has to fall in, as two `YYYY-MM-DD` bounds.
 *
 * The upper bound is tomorrow in UTC rather than today. The browser fills the
 * field with the reporter's *local* date, and local runs a day ahead of UTC as
 * far east as Kiritimati; refusing that would reject today's report from a
 * third of the Pacific. A single day of slack buys a post-dater nothing.
 */
export function incidentDateRange(now: Date): {
  earliest: string;
  latest: string;
} {
  return {
    earliest: utcCalendarDate(
      new Date(now.getTime() - MAX_BACKDATE_DAYS * MS_PER_DAY),
    ),
    latest: utcCalendarDate(new Date(now.getTime() + MS_PER_DAY)),
  };
}

/** Whether a reported date is real and inside the window. */
export function isWithinIncidentRange(value: unknown, now: Date): boolean {
  if (!isCalendarDate(value)) return false;

  const { earliest, latest } = incidentDateRange(now);
  // Zero-padded ISO dates compare as strings exactly as they compare as dates,
  // which keeps this free of another round through the Date constructor.
  return value >= earliest && value <= latest;
}

/**
 * "August 19, 2026", for showing a reader the day itself rather than a distance
 * from now. Formatted in UTC so the day cannot shift under a reader's timezone.
 */
export function formatIncidentDate(value: unknown): string {
  const date = parseCalendarDate(value);
  if (!date) return '';

  return date.toLocaleDateString('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
