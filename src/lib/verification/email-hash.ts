/**
 * A stable, non-reversible identifier for an email address.
 *
 * Used to rate-limit a reporter and to recognise a returning one without
 * keeping a readable address around. A plain SHA-256 would not be enough:
 * the set of email addresses is small enough to work through exhaustively, so
 * the hash is keyed with a server-side secret an attacker does not hold.
 *
 * Addresses are normalised first, so `Luca@Example.com ` and
 * `luca@example.com` are the same person.
 */

import { createHmac } from 'node:crypto';

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string, secret: string): string {
  if (!secret) {
    throw new Error('Refusing to hash an email address without a secret');
  }

  return createHmac('sha256', secret)
    .update(normaliseEmail(email), 'utf8')
    .digest('hex');
}
