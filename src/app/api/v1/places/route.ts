import { NextResponse } from 'next/server';

import { readSigningConfig } from '@/lib/config/env';
import { getGeocoder, getRateLimiter } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { hashClientAddress, readClientAddress } from '@/lib/http/client-address';
import { isSearchableQuery } from '@/lib/geo/places';
import { PLACE_SEARCHES_PER_IP_PER_MINUTE } from '@/lib/security/rate-limit';

/**
 * Place suggestions for the report form's location step.
 *
 * Proxied rather than called from the browser: a public geocoder is a shared
 * resource, and this is where we cap our own traffic and identify ourselves.
 */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get('q') ?? '';

  if (!isSearchableQuery(query)) {
    // Not an error — just nothing worth searching for yet.
    return NextResponse.json(success({ places: [] }).body, { status: 200 });
  }

  const ipHash = hashClientAddress(
    readClientAddress(request.headers),
    readSigningConfig().secret,
  );

  const limit = await getRateLimiter().check(
    `places:${ipHash}`,
    PLACE_SEARCHES_PER_IP_PER_MINUTE,
  );

  if (!limit.allowed) {
    const result = failure('rate_limited', 'Too many searches. Slow down a little.', {
      retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: { 'Retry-After': String(result.retryAfterSeconds ?? 60) },
    });
  }

  const places = await getGeocoder().search(query.trim());

  return NextResponse.json(success({ places }).body, {
    status: 200,
    headers: {
      // The same query gives the same answer for everyone, for a while.
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
