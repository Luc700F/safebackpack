/**
 * What happens to a report when its time on the map is up.
 *
 * It is not deleted. It is stripped of everything that ties it to a person and
 * kept, so statistics and country profiles can be built later from questions
 * nobody has thought of yet. A pre-computed summary would fix today's
 * questions in place forever.
 *
 * What is removed: the email address, the reporter's name, the exact position
 * and the free-text description. The description is the most useful field for a
 * human reader and the most likely to name someone — "the man at the hostel on
 * Soi 12" — so it does not survive.
 *
 * What remains carries no link to a person: category, country, a coarse cell,
 * the month, the time of day, and how many travellers confirmed it.
 */

import type { ReportCategoryId } from './categories';
import type { TimeOfDayId } from './time-of-day';

/**
 * Grid resolution in degrees for the retained position. 0.1° is roughly 11 km
 * — fine enough to tell one city from the next, coarse enough that the point
 * identifies a place rather than an address.
 */
export const RETAINED_GRID_DEGREES = 0.1;

export interface AnonymisableReport {
  categoryId: ReportCategoryId;
  countryCode: string;
  timeOfDayId: TimeOfDayId;
  latitude: number;
  longitude: number;
  publishedAt: Date;
  confirmationCount: number;
}

/** The fields an anonymised report keeps. Everything else is cleared. */
export interface AnonymisedReport {
  categoryId: ReportCategoryId;
  countryCode: string;
  timeOfDayId: TimeOfDayId;
  /** South-west corner of the grid cell the report fell into. */
  cellLatitude: number;
  cellLongitude: number;
  /** Calendar month in UTC, formatted YYYY-MM. */
  month: string;
  confirmationCount: number;
}

/** Formats a date as its UTC calendar month, e.g. `2026-08`. */
export function toMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Snaps a coordinate down to the south-west corner of its grid cell.
 * Rounded to the grid's own precision so floating point noise never splits one
 * cell into two.
 */
export function toGridCell(
  latitude: number,
  longitude: number,
): { cellLatitude: number; cellLongitude: number } {
  return {
    cellLatitude: snap(latitude),
    cellLongitude: snap(longitude),
  };
}

function snap(value: number): number {
  const decimals = decimalsOf(RETAINED_GRID_DEGREES);

  // 13.7 / 0.1 is 136.99999999999997 in binary floating point, so flooring the
  // raw quotient would drop a point sitting exactly on a cell boundary into the
  // cell below it. Rounding the quotient to a sane precision first removes the
  // representation noise without hiding a genuine fraction.
  const quotient = Number((value / RETAINED_GRID_DEGREES).toFixed(9));
  const snapped = Math.floor(quotient) * RETAINED_GRID_DEGREES;

  // `+ 0` turns -0 into 0 so keys compare and serialise consistently.
  return Number(snapped.toFixed(decimals)) + 0;
}

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function anonymise(report: AnonymisableReport): AnonymisedReport {
  const { cellLatitude, cellLongitude } = toGridCell(
    report.latitude,
    report.longitude,
  );

  return {
    categoryId: report.categoryId,
    countryCode: report.countryCode,
    timeOfDayId: report.timeOfDayId,
    cellLatitude,
    cellLongitude,
    month: toMonth(report.publishedAt),
    confirmationCount: report.confirmationCount,
  };
}

/** Field names that must be empty on an anonymised row. Used by the tests. */
export const CLEARED_FIELDS = [
  'description',
  'reporterFirstName',
  'reporterEmail',
  'reporterEmailHash',
  'exactPosition',
] as const;
