import { NextResponse } from 'next/server';

import { hasAdminSession } from '@/lib/admin/session';
import { readSigningConfig } from '@/lib/config/env';
import { getReportService } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { ADMIN_COOKIE, readCookie } from '@/lib/http/cookies';

/**
 * The moderation queue.
 *
 * Carries the reporter's own words and what the screener objected to, because
 * that is what a decision needs. It carries no email address: knowing who
 * wrote a report would not help the judgement and would put the one piece of
 * personal data we hold in front of a screen for no reason.
 */
export async function GET(request: Request): Promise<Response> {
  const signing = readSigningConfig();

  if (
    !hasAdminSession(
      readCookie(request.headers.get('cookie'), ADMIN_COOKIE),
      signing.secret,
    )
  ) {
    const result = failure('not_recognised', 'Not signed in.', { status: 401 });
    return NextResponse.json(result.body, { status: result.status });
  }

  const held = await getReportService().listHeldForReview();

  return NextResponse.json(
    success({
      reports: held.map((report) => ({
        id: report.id,
        categoryId: report.categoryId,
        customCategoryLabel: report.customCategoryLabel,
        description: report.description,
        timeOfDay: report.timeOfDay,
        countryCode: report.countryCode,
        reporterFirstName: report.publishAnonymously
          ? null
          : report.reporterFirstName,
        reporterHomeCountry: report.reporterHomeCountry,
        createdAt: report.createdAt.toISOString(),
        reasons: report.screeningReasons,
      })),
    }).body,
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
