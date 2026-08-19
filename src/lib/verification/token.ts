/**
 * Email verification tokens.
 *
 * The token that goes out by email is never stored. Only its SHA-256 hash is
 * kept, so a leaked database does not hand an attacker working verification
 * links. Comparison is timing-safe, and a token is single-use and short-lived.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** How long a verification link stays usable. */
export const TOKEN_TTL_MINUTES = 30;

const TOKEN_BYTES = 32;

export interface IssuedToken {
  /** Goes into the email link. Never stored, never logged. */
  token: string;
  /** Stored alongside the pending report. */
  tokenHash: string;
  expiresAt: Date;
}

export function createVerificationToken(now: Date = new Date()): IssuedToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000),
  };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Timing-safe comparison of a submitted token against the stored hash.
 * Returns false for malformed input rather than throwing, so a hand-edited
 * link produces a normal "invalid link" page.
 */
export function matchesTokenHash(token: string, storedHash: string): boolean {
  if (typeof token !== 'string' || typeof storedHash !== 'string') return false;

  const candidate = Buffer.from(hashToken(token), 'hex');
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }

  if (candidate.length !== stored.length) return false;

  return timingSafeEqual(candidate, stored);
}

export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}
