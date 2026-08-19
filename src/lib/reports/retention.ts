/**
 * Retention policy: a published report is visible for six months and is then
 * hard-deleted, together with its photos and the email address that verified
 * it. What survives is only the anonymous aggregate produced by
 * `src/lib/reports/archive.ts`.
 */

export const RETENTION_DAYS = 180;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RetainedReport {
  id: string;
  publishedAt: Date;
}

/** The moment a report published at `publishedAt` becomes eligible for deletion. */
export function expiresAt(publishedAt: Date): Date {
  return new Date(publishedAt.getTime() + RETENTION_DAYS * MILLISECONDS_PER_DAY);
}

export function isExpired(publishedAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt(publishedAt).getTime();
}

/** Whole days left before deletion, floored at zero. */
export function daysUntilExpiry(publishedAt: Date, now: Date): number {
  const remaining = expiresAt(publishedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / MILLISECONDS_PER_DAY));
}

/** The subset of `reports` the nightly retention job must delete. */
export function selectExpired<T extends RetainedReport>(
  reports: readonly T[],
  now: Date,
): T[] {
  return reports.filter((report) => isExpired(report.publishedAt, now));
}
