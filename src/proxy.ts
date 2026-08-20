import { type NextRequest, NextResponse } from 'next/server';

import { isSameOrigin } from '@/lib/http/origin';

/**
 * Runs before every request.
 *
 * Two jobs: put a Content-Security-Policy on every page, and refuse a request
 * that changes something unless it came from our own pages.
 *
 * (Next.js 16 renamed `middleware` to `proxy`; this is the same mechanism.)
 */

/** Where the map fetches its tiles, sprites and glyphs from. */
const TILES = 'https://tiles.openfreemap.org';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Localhost has no TLS, so upgrading its requests only breaks them. */
function isLocal(host: string | null): boolean {
  if (!host) return false;
  const name = host.split(':')[0];
  return name === 'localhost' || name === '127.0.0.1' || name === '[::1]';
}

function contentSecurityPolicy(
  nonce: string,
  isDevelopment: boolean,
  overTls: boolean,
): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' means a script we vouched for may load others, and
    // nothing else may — host allowlists stop counting, which is the point.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDevelopment ? " 'unsafe-eval'" : ''
    }`,
    // Styles keep 'unsafe-inline'. MapLibre writes its own, and a stylesheet
    // cannot exfiltrate data the way a script can, so the trade is worth far
    // less than it costs in breakage.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${TILES}`,
    `connect-src 'self' ${TILES}`,
    // The map's tile worker is served from our own origin.
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only where there is TLS to upgrade to. WebKit applies this on localhost
    // as well — Chromium exempts it — and every request then fails with a TLS
    // error, which is a confusing way to find out.
    ...(overTls ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const sameOrigin = isSameOrigin({
    origin: request.headers.get('origin'),
    host:
      request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
  });

  if (MUTATING.has(request.method) && !sameOrigin) {
    return NextResponse.json(
      {
        error: {
          code: 'malformed_request',
          message: 'This request did not come from safebackpack.app.',
        },
      },
      { status: 403 },
    );
  }

  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');

  const nonce = crypto.randomUUID();
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
    !isLocal(host),
  );

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // Next.js reads the nonce out of the policy on the *request* and stamps it
  // onto the scripts it renders. Without this the framework's own bootstrap
  // scripts are blocked and nothing on the page runs.
  headers.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, which need no policy and no check.
    {
      source: '/((?!_next/static|_next/image|favicon.ico|vendor).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
