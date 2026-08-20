/**
 * Letting the scheduler in, and nobody else.
 *
 * A cron endpoint that anybody can call is an endpoint anybody can use to
 * empty the map. Vercel sends `Authorization: Bearer <CRON_SECRET>` with every
 * scheduled request; nothing else knows that value.
 *
 * Compared in constant time, because a timing difference on a secret is a way
 * to guess it one character at a time.
 */

import { timingSafeEqual } from 'node:crypto';

export function isAuthorisedCron(
  header: string | null,
  secret: string | undefined,
): boolean {
  // No secret configured means the endpoint is closed, not open.
  if (!secret) return false;
  if (!header?.startsWith('Bearer ')) return false;

  const provided = Buffer.from(header.slice('Bearer '.length), 'utf8');
  const expected = Buffer.from(secret, 'utf8');

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
