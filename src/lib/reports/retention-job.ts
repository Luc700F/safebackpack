/**
 * The nightly pass that clears reports whose time is up.
 *
 * Two passes, because two things end differently. A report that was on the map
 * is anonymised — `anonymisation.ts` says what survives and why — so the
 * statistics keep a countable trace of something people actually saw. A report
 * that was never published is deleted outright: nobody ever saw it, so there
 * is nothing worth counting, only a name and an address the privacy notice
 * promises to be rid of. Work is done in batches so a long backlog — after downtime, say — never
 * loads an unbounded number of rows into memory at once.
 *
 * Written as a plain function over the repository so it can be tested without
 * a scheduler, and driven by whatever schedules it in production.
 */

import { anonymise } from './anonymisation';
import type { ReportRepository, StoredReport } from './repository';

export const DEFAULT_BATCH_SIZE = 200;

export interface RetentionResult {
  anonymised: number;
  /** Never-published reports removed outright. */
  deleted: number;
  /** Reports that could not be processed, with the reason. */
  failures: { id: string; reason: string }[];
}

export async function runRetention(
  repository: ReportRepository,
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<RetentionResult> {
  const result: RetentionResult = { anonymised: 0, deleted: 0, failures: [] };
  const seen = new Set<string>();

  for (;;) {
    const due = await repository.findDueForAnonymisation(now, batchSize);
    // A batch that yields nothing new means the remainder cannot be processed;
    // stopping avoids looping forever over rows that keep failing.
    const fresh = due.filter((report) => !seen.has(report.id));
    if (fresh.length === 0) break;

    for (const report of fresh) {
      seen.add(report.id);

      try {
        await repository.anonymise(report.id, retainedFrom(report), now);
        result.anonymised += 1;
      } catch (error) {
        // One bad row must not stop the pass; the rest still need clearing.
        result.failures.push({
          id: report.id,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }
  }

  await deleteNeverPublished(repository, now, batchSize, result);

  return result;
}

/**
 * Removes what was never on the map: drafts whose verification link lapsed,
 * and reports held or rejected long enough that a published one would already
 * have gone. Nothing about them is retained, because nothing about them was
 * ever public.
 */
async function deleteNeverPublished(
  repository: ReportRepository,
  now: Date,
  batchSize: number,
  result: RetentionResult,
): Promise<void> {
  const seen = new Set<string>();

  for (;;) {
    const due = await repository.findDueForDeletion(now, batchSize);
    const fresh = due.filter((report) => !seen.has(report.id));
    if (fresh.length === 0) break;

    for (const report of fresh) {
      seen.add(report.id);

      try {
        await repository.deleteReport(report.id);
        result.deleted += 1;
      } catch (error) {
        result.failures.push({
          id: report.id,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }
  }
}

function retainedFrom(report: StoredReport) {
  if (!report.position || !report.publishedAt) {
    throw new Error('Report has no position or publication date to retain');
  }

  return anonymise({
    categoryId: report.categoryId,
    countryCode: report.countryCode,
    timeOfDayId: report.timeOfDay,
    latitude: report.position.latitude,
    longitude: report.position.longitude,
    publishedAt: report.publishedAt,
    confirmationCount: report.confirmationCount,
  });
}
