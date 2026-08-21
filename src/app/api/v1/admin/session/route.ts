import { NextResponse } from 'next/server';

import { createAdminSession, isCorrectPassword } from '@/lib/admin/session';
import { readSigningConfig } from '@/lib/config/env';
import { getRateLimiter } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { hashClientAddress, readClientAddress } from '@/lib/http/client-address';
import { ADMIN_COOKIE, adminCookieOptions } from '@/lib/http/cookies';
import { ADMIN_SIGN_IN_PER_IP_PER_HOUR } from '@/lib/security/rate-limit';

/** Signs the operator in. */
export async function POST(request: Request): Promise<Response> {
  const signing = readSigningConfig();

  const limit = await getRateLimiter().check(
    `admin:${hashClientAddress(readClientAddress(request.headers), signing.secret)}`,
    ADMIN_SIGN_IN_PER_IP_PER_HOUR,
  );

  if (!limit.allowed) {
    const result = failure('rate_limited', 'Too many attempts. Try again later.', {
      retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
    });
    return NextResponse.json(result.body, { status: result.status });
  }

  let payload: { password?: unknown };
  try {
    payload = (await request.json()) as { password?: unknown };
  } catch {
    const result = failure('malformed_request', 'Expected a JSON body.');
    return NextResponse.json(result.body, { status: result.status });
  }

  if (!isCorrectPassword(payload?.password, process.env.ADMIN_PASSWORD)) {
    // One message for a wrong password and for no password configured: which
    // of the two it is would tell an attacker something.
    const result = failure('not_recognised', 'That password is not right.', {
      status: 401,
    });
    return NextResponse.json(result.body, { status: result.status });
  }

  const response = NextResponse.json(success({ signedIn: true }).body);
  response.cookies.set(
    ADMIN_COOKIE,
    createAdminSession(signing.secret),
    adminCookieOptions(signing.siteUrl),
  );

  return response;
}

/** Signs the operator out. */
export async function DELETE(): Promise<Response> {
  const response = NextResponse.json(success({ signedIn: false }).body);
  response.cookies.set(ADMIN_COOKIE, '', {
    ...adminCookieOptions(readSigningConfig().siteUrl),
    maxAge: 0,
  });

  return response;
}
