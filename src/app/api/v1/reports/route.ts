import { NextResponse } from 'next/server';

import { getReportService } from '@/lib/container';
import { readSigningConfig } from '@/lib/config/env';
import { failure } from '@/lib/http/api-result';
import { hashClientAddress, readClientAddress } from '@/lib/http/client-address';
import { RECOGNITION_COOKIE, readCookie } from '@/lib/http/cookies';
import { recognitionCookieOptions } from '@/lib/http/cookies';
import { submitOutcomeToResult } from '@/lib/reports/api-mapping';
import { success } from '@/lib/http/api-result';

/**
 * The published reports for the map and the list view.
 *
 * Public data, identical for everyone, so it may be cached at the edge for a
 * minute. Nothing here depends on who is asking.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const result = success(
    await getReportService().listPublished({
      window: params.get('window') ?? undefined,
      categories: params.get('categories') ?? undefined,
      country: params.get('country') ?? undefined,
    }),
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

/**
 * Files a report. The website is one client of this endpoint; a native app
 * would call exactly the same one.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const result = failure('malformed_request', 'Expected a JSON body.');
    return NextResponse.json(result.body, { status: result.status });
  }

  const signing = readSigningConfig();
  const outcome = await getReportService().submit(payload, {
    ipHash: hashClientAddress(
      readClientAddress(request.headers),
      signing.secret,
    ),
    recognitionToken: readCookie(
      request.headers.get('cookie'),
      RECOGNITION_COOKIE,
    ),
  });

  const result = submitOutcomeToResult(outcome);
  const response = NextResponse.json(result.body, { status: result.status });

  if (result.retryAfterSeconds !== undefined) {
    response.headers.set('Retry-After', String(result.retryAfterSeconds));
  }

  // A reporter who was recognised is published straight away and gets a fresh
  // token, so the recognition window rolls forward.
  if (outcome.status === 'published') {
    response.cookies.set(
      RECOGNITION_COOKIE,
      outcome.recognitionToken,
      recognitionCookieOptions(signing.siteUrl),
    );
  }

  return response;
}
