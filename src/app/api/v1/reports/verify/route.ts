import { NextResponse } from 'next/server';

import { readSigningConfig } from '@/lib/config/env';
import { getReportService } from '@/lib/container';
import { failure } from '@/lib/http/api-result';
import { RECOGNITION_COOKIE, recognitionCookieOptions } from '@/lib/http/cookies';
import { verifyOutcomeToResult } from '@/lib/reports/api-mapping';

/**
 * Confirms an email address and publishes the report behind it.
 *
 * A POST rather than a GET: mail clients and security scanners follow links in
 * messages, and a GET here would publish reports nobody confirmed.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: { token?: unknown };
  try {
    payload = (await request.json()) as { token?: unknown };
  } catch {
    const result = failure('malformed_request', 'Expected a JSON body.');
    return NextResponse.json(result.body, { status: result.status });
  }

  const outcome = await getReportService().verify(payload?.token);
  const result = verifyOutcomeToResult(outcome);
  const response = NextResponse.json(result.body, { status: result.status });

  if (outcome.status === 'published') {
    const signing = readSigningConfig();
    response.cookies.set(
      RECOGNITION_COOKIE,
      outcome.recognitionToken,
      recognitionCookieOptions(signing.siteUrl),
    );
  }

  return response;
}
