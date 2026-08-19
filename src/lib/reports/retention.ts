/**
 * How long a report stays visible.
 *
 * Visibility is earned by currency rather than granted by the calendar. Every
 * report starts with a short life; each confirmation from another traveller
 * extends it, because a hazard others still see is a hazard that still exists.
 * A hard ceiling stops a heavily confirmed report from living forever — the
 * promise that everything is eventually deleted has no exceptions.
 *
 * What survives deletion is the anonymous aggregate in `archive.ts`, so long
 * term statistics never depend on keeping personal data around.
 */

/** Life of a report nobody has confirmed. */
export const BASE_RETENTION_DAYS = 90;

/** Added by each confirmation that the report still applies. */
export const CONFIRMATION_EXTENSION_DAYS = 30;

/** No report outlives this, however often it is confirmed. */
export const MAX_RETENTION_DAYS = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RetainedReport {
  id: string;
  publishedAt: Date;
  confirmationCount?: number;
}

/**
 * When a report becomes eligible for deletion.
 * Confirmations extend it; the ceiling always wins.
 */
export function expiresAt(publishedAt: Date, confirmationCount = 0): Date {
  const earned =
    BASE_RETENTION_DAYS +
    Math.max(0, Math.floor(confirmationCount)) * CONFIRMATION_EXTENSION_DAYS;

  const days = Math.min(earned, MAX_RETENTION_DAYS);

  return new Date(publishedAt.getTime() + days * MS_PER_DAY);
}

/** How many confirmations it takes to reach the ceiling. */
export const CONFIRMATIONS_TO_MAXIMUM = Math.ceil(
  (MAX_RETENTION_DAYS - BASE_RETENTION_DAYS) / CONFIRMATION_EXTENSION_DAYS,
);

export function isExpired(
  publishedAt: Date,
  now: Date,
  confirmationCount = 0,
): boolean {
  return now.getTime() >= expiresAt(publishedAt, confirmationCount).getTime();
}

/** Whole days left before deletion, floored at zero. */
export function daysUntilExpiry(
  publishedAt: Date,
  now: Date,
  confirmationCount = 0,
): number {
  const remaining =
    expiresAt(publishedAt, confirmationCount).getTime() - now.getTime();

  return Math.max(0, Math.ceil(remaining / MS_PER_DAY));
}

/** The subset of `reports` the nightly retention job must delete. */
export function selectExpired<T extends RetainedReport>(
  reports: readonly T[],
  now: Date,
): T[] {
  return reports.filter((report) =>
    isExpired(report.publishedAt, now, report.confirmationCount ?? 0),
  );
}
