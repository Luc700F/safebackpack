/**
 * Letting the operator in, and nobody else.
 *
 * One password, held in the environment, exchanged for a signed session that
 * lasts a day. Not an account system: there is exactly one person who
 * moderates, and building user accounts to serve one person would be a great
 * deal of surface area for no benefit.
 *
 * The password is compared in constant time. The session token carries only an
 * expiry and a signature — there is nothing in it worth stealing except the
 * session itself, and it lapses on its own.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long a moderation session lasts before it has to be renewed. */
export const ADMIN_SESSION_HOURS = 24;

const SEPARATOR = '.';
const LABEL = 'admin-session';

export function isCorrectPassword(
  provided: unknown,
  expected: string | undefined,
): boolean {
  // No password configured means the door is shut, not open.
  if (!expected) return false;
  if (typeof provided !== 'string' || provided.length === 0) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  // Comparing different lengths would leak the length through timing, so the
  // lengths are checked first and the contents only when they match.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function createAdminSession(secret: string, now: Date = new Date()): string {
  if (!secret) {
    throw new Error('Refusing to sign a moderation session without a secret');
  }

  const expiresAt = now.getTime() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${LABEL}${SEPARATOR}${expiresAt}`;

  return `${payload}${SEPARATOR}${sign(payload, secret)}`;
}

/**
 * True when the token is one we signed and has not lapsed. Never throws: a
 * malformed cookie means "not signed in", not an error page.
 */
export function hasAdminSession(
  token: unknown,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (typeof token !== 'string' || !secret) return false;

  const parts = token.split(SEPARATOR);
  if (parts.length !== 3) return false;

  const [label, expiresAtRaw, signature] = parts;
  if (label !== LABEL) return false;

  const payload = `${label}${SEPARATOR}${expiresAtRaw}`;
  if (!isSignatureValid(payload, signature, secret)) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt)) return false;

  return now.getTime() < expiresAt;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', `${LABEL}:${secret}`)
    .update(payload, 'utf8')
    .digest('base64url');
}

function isSignatureValid(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(sign(payload, secret), 'utf8');
  const provided = Buffer.from(signature, 'utf8');

  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}
