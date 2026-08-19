/**
 * Annual risk reporting without keeping personal data.
 *
 * Before the retention job deletes a report, its bare statistical shape is
 * folded into an aggregate row. The aggregate deliberately drops everything
 * that could identify a reporter or a victim: no description, no photos, no
 * email, no reporter name, and no precise position — coordinates are collapsed
 * onto a coarse grid and the date onto a month.
 *
 * Aggregate rows are therefore anonymous and can be kept indefinitely.
 */

import type { ReportCategoryId } from './categories';

/** Grid resolution in degrees. 0.5° is roughly 55 km at the equator. */
export const ARCHIVE_GRID_DEGREES = 0.5;

export interface ArchivableReport {
  categoryId: ReportCategoryId;
  /** ISO 3166-1 alpha-2, derived server-side from the coordinates. */
  countryCode: string;
  latitude: number;
  longitude: number;
  publishedAt: Date;
}

export interface ArchiveRow {
  /** Calendar month in UTC, formatted YYYY-MM. */
  month: string;
  countryCode: string;
  categoryId: ReportCategoryId;
  /** South-west corner of the grid cell the report fell into. */
  cellLatitude: number;
  cellLongitude: number;
  count: number;
}

/** Formats a date as its UTC calendar month, e.g. `2026-08`. */
export function toArchiveMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Snaps a coordinate down to the south-west corner of its grid cell.
 * Rounded to the grid's own precision so that floating point noise never
 * splits one cell into two.
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
  const decimals = decimalsOf(ARCHIVE_GRID_DEGREES);
  const snapped = Math.floor(value / ARCHIVE_GRID_DEGREES) * ARCHIVE_GRID_DEGREES;
  // `+ 0` turns -0 into 0 so that keys compare and serialise consistently.
  return Number(snapped.toFixed(decimals)) + 0;
}

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Folds reports into anonymous counts, one row per
 * month × country × category × grid cell. Rows are returned in a stable order
 * so that output is reproducible and easy to diff.
 */
export function aggregateForArchive(
  reports: readonly ArchivableReport[],
): ArchiveRow[] {
  const rows = new Map<string, ArchiveRow>();

  for (const report of reports) {
    const month = toArchiveMonth(report.publishedAt);
    const { cellLatitude, cellLongitude } = toGridCell(
      report.latitude,
      report.longitude,
    );
    const key = [
      month,
      report.countryCode,
      report.categoryId,
      cellLatitude,
      cellLongitude,
    ].join('|');

    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    rows.set(key, {
      month,
      countryCode: report.countryCode,
      categoryId: report.categoryId,
      cellLatitude,
      cellLongitude,
      count: 1,
    });
  }

  return [...rows.values()].sort(compareRows);
}

function compareRows(a: ArchiveRow, b: ArchiveRow): number {
  return (
    a.month.localeCompare(b.month) ||
    a.countryCode.localeCompare(b.countryCode) ||
    a.categoryId.localeCompare(b.categoryId) ||
    a.cellLatitude - b.cellLatitude ||
    a.cellLongitude - b.cellLongitude
  );
}
