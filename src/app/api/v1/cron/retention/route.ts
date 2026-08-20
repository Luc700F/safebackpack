import { NextResponse } from 'next/server';

import { getReportService, getReportRepositoryForJobs } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { isAuthorisedCron } from '@/lib/http/cron-auth';
import { runRetention } from '@/lib/reports/retention-job';

/**
 * Takes expired reports off the map, nightly.
 *
 * Without this the privacy notice promises something that never happens: a
 * report would sit in the database with a name and an email address on it
 * forever. The job itself is in src/lib/reports/retention-job.ts and is tested
 * there; this is only the door the scheduler knocks on.
 *
 * Scheduled by vercel.json. Authorised by CRON_SECRET, which Vercel sends and
 * nothing else knows.
 */
export async function GET(request: Request): Promise<Response> {
  if (
    !isAuthorisedCron(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  ) {
    const result = failure('not_found', 'Not found.');
    return NextResponse.json(result.body, { status: result.status });
  }

  const repository = getReportRepositoryForJobs();
  const outcome = await runRetention(repository);

  // A failure here is worth seeing in the platform logs: it means personal
  // data is sitting somewhere it should no longer be.
  if (outcome.failures.length > 0) {
    console.error(
      `retention: ${outcome.failures.length} report(s) could not be anonymised`,
      outcome.failures.map((failed) => failed.id),
    );
  }

  // Touch the service so the process warms the same singletons the app uses.
  getReportService();

  return NextResponse.json(
    success({
      anonymised: outcome.anonymised,
      failed: outcome.failures.length,
    }).body,
  );
}
