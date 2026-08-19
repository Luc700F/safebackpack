/**
 * Recognising a reporter who already verified their address.
 *
 * After one successful verification the browser carries a signed token so the
 * next report does not send the traveller back to their inbox. The token holds
 * only a hash of the email address — never the address itself — and it is
 * signed, so it cannot be forged or edited into somebody else's identity.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long a verified reporter stays recognised in the same browser. */
export const RECOGNITION_DAYS = 30;

const SEPARATOR = '.';

export interface Recognition {
  emailHash: string;
  expiresAt: Date;
}

export function createRecognitionToken(
  emailHash: string,
  secret: string,
  now: Date = new Date(),
): string {
  if (!secret) {
    throw new Error('Refusing to sign a recognition token without a secret');
  }

  const expiresAt = now.getTime() + RECOGNITION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${emailHash}${SEPARATOR}${expiresAt}`;

  return `${payload}${SEPARATOR}${sign(payload, secret)}`;
}

/**
 * Returns the recognition carried by a token, or `null` when it is malformed,
 * tampered with, or past its expiry. Never throws on bad input: an expired or
 * forged cookie simply means "verify again".
 */
export function readRecognitionToken(
  token: unknown,
  secret: string,
  now: Date = new Date(),
): Recognition | null {
  if (typeof token !== 'string' || !secret) return null;

  const parts = token.split(SEPARATOR);
  if (parts.length !== 3) return null;

  const [emailHash, expiresAtRaw, signature] = parts;
  const payload = `${emailHash}${SEPARATOR}${expiresAtRaw}`;

  if (!isSignatureValid(payload, signature, secret)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt)) return null;
  if (now.getTime() >= expiresAt) return null;

  return { emailHash, expiresAt: new Date(expiresAt) };
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
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
