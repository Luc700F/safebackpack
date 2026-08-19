/**
 * The nightly pass that takes expired reports off the map.
 *
 * It anonymises rather than deletes; `anonymisation.ts` says what survives and
 * why. Work is done in batches so a long backlog — after downtime, say — never
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
  /** Reports that could not be processed, with the reason. */
  failures: { id: string; reason: string }[];
}

export async function runRetention(
  repository: ReportRepository,
  now: Date = new Date(),
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<RetentionResult> {
  const result: RetentionResult = { anonymised: 0, failures: [] };
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

  return result;
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
