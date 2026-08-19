/**
 * How long a report stays visible.
 *
 * A report lives 60 days on its own. A confirmation from another traveller
 * pushes the end out to 30 days **from the moment of that confirmation** —
 * not from publication — because what a confirmation says is "this was still
 * true today", and that statement ages from today. A hard ceiling of 90 days
 * from publication stops a chain of confirmations from keeping something alive
 * forever: the promise that everything is eventually deleted has no exceptions,
 * and the widest filter on the map is 90 days for the same reason.
 *
 * The extension matters mostly for hazards that persist — a blocked road, a
 * flooded coast — where one event gets confirmed rather than reported again.
 * Thefts and scams regenerate on their own: each new victim files a new
 * report, and it is the count of those that tells a reader something.
 *
 * What survives expiry is the anonymous row in `anonymisation.ts`, so long
 * term statistics never depend on keeping personal data around.
 */

/** Life of a report nobody has confirmed. */
export const BASE_RETENTION_DAYS = 60;

/** How long a confirmation keeps a report alive, counted from the confirmation. */
export const CONFIRMATION_EXTENSION_DAYS = 30;

/** No report outlives this, counted from publication, however often confirmed. */
export const MAX_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RetainedReport {
  id: string;
  publishedAt: Date;
  /** When another traveller last said it still applies. */
  lastConfirmedAt?: Date | null;
}

/**
 * When a report becomes eligible for anonymisation.
 *
 * The later of "published plus 60 days" and "last confirmed plus 30 days",
 * never beyond 90 days from publication.
 */
export function expiresAt(
  publishedAt: Date,
  lastConfirmedAt: Date | null = null,
): Date {
  const base = publishedAt.getTime() + BASE_RETENTION_DAYS * MS_PER_DAY;
  const ceiling = publishedAt.getTime() + MAX_RETENTION_DAYS * MS_PER_DAY;

  const earned = lastConfirmedAt
    ? lastConfirmedAt.getTime() + CONFIRMATION_EXTENSION_DAYS * MS_PER_DAY
    : 0;

  return new Date(Math.min(Math.max(base, earned), ceiling));
}

export function isExpired(
  publishedAt: Date,
  now: Date,
  lastConfirmedAt: Date | null = null,
): boolean {
  return now.getTime() >= expiresAt(publishedAt, lastConfirmedAt).getTime();
}

/** Whole days left before it leaves the map, floored at zero. */
export function daysUntilExpiry(
  publishedAt: Date,
  now: Date,
  lastConfirmedAt: Date | null = null,
): number {
  const remaining =
    expiresAt(publishedAt, lastConfirmedAt).getTime() - now.getTime();

  return Math.max(0, Math.ceil(remaining / MS_PER_DAY));
}

/** The subset of `reports` the nightly job must take off the map. */
export function selectExpired<T extends RetainedReport>(
  reports: readonly T[],
  now: Date,
): T[] {
  return reports.filter((report) =>
    isExpired(report.publishedAt, now, report.lastConfirmedAt ?? null),
  );
}
