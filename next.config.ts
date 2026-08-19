import type { NextConfig } from 'next';

/**
 * Baseline security headers. These apply to every response and cost nothing.
 * The Content-Security-Policy is deliberately not here: it needs a per-request
 * nonce and therefore lives in `proxy.ts`, which arrives with the hardening
 * stage. See docs/architecture.md.
 */
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Geolocation stays enabled for "what is around me"; everything else is off.
    value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  // Pin the workspace root: without it Next.js walks up into the synced
  // cloud folder and picks up an unrelated lockfile.
  // Do not advertise the framework and its version to attackers.
  poweredByHeader: false,

  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
