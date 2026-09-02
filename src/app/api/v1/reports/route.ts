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
 * Not cached, deliberately. This is public data identical for everyone, which
 * is exactly the shape a CDN is for — and it was cached at the edge for a
 * minute with five more minutes of serving it stale. The effect was that a
 * reporter who had just published something reloaded the map and did not find
 * it, which reads as "the site lost my report".
 *
 * A safety map whose whole argument is freshness cannot answer with a
 * five-minute-old picture to save a function call. If the traffic ever makes
 * that trade worth revisiting, the way back is a short `s-maxage` with no
 * `stale-while-revalidate`, not this.
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
      'Cache-Control': 'no-store',
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
