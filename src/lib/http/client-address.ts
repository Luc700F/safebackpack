/**
 * Identifying the caller's network address, for abuse limits only.
 *
 * The address itself is never stored. What is kept is a keyed hash, briefly,
 * because a raw IP address is personal data and a bare hash of one is trivial
 * to reverse — there are only about four billion of them.
 *
 * Only the proxy's own value is trusted. `x-forwarded-for` can be forged by the
 * client, so anything beyond the entry the platform itself prepends is ignored.
 */

import { createHmac } from 'node:crypto';

export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * The address the platform saw. Returns null when no proxy header is present,
 * which in production means something is misconfigured.
 */
export function readClientAddress(headers: HeaderReader): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // The platform prepends the real client; entries after it are hearsay.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return headers.get('x-real-ip')?.trim() || null;
}

/**
 * A stable, non-reversible handle for a caller. Falls back to a single shared
 * bucket when the address is unknown, so a misconfigured proxy tightens the
 * limits rather than removing them.
 */
export function hashClientAddress(
  address: string | null,
  secret: string,
): string {
  if (!secret) {
    throw new Error('Refusing to hash a client address without a secret');
  }

  return createHmac('sha256', secret)
    .update(address ?? 'unknown-client', 'utf8')
    .digest('hex');
}
