/**
 * Authenticated encryption for the few values that must be stored readable
 * again — today only the reporter's email address.
 *
 * Encryption happens in the application rather than in SQL. A database
 * function would need the key as part of the statement, and statements end up
 * in slow-query logs, error reports and monitoring tools.
 *
 * AES-256-GCM: the ciphertext cannot be altered without detection, so a
 * tampered row fails loudly instead of decrypting to something else.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Derives the encryption key from the application secret, so the deployment
 * carries one secret rather than several that can drift apart. Separated by a
 * label so this key is not the same value used for signing.
 */
function deriveKey(secret: string): Buffer {
  if (!secret) {
    throw new Error('Refusing to encrypt without a secret');
  }

  return createHash('sha256').update(`safebackpack:box:${secret}`).digest();
}

/** Returns iv | tag | ciphertext, ready to store in a bytea column. */
export function seal(plaintext: string, secret: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export class SealedValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SealedValueError';
  }
}

export function open(sealed: Buffer, secret: string): string {
  if (sealed.length < IV_BYTES + TAG_BYTES) {
    throw new SealedValueError('Sealed value is too short to be valid');
  }

  const iv = sealed.subarray(0, IV_BYTES);
  const tag = sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = sealed.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Wrong key, or the stored bytes were altered. Both are the same answer:
    // this value cannot be trusted.
    throw new SealedValueError('Sealed value could not be opened');
  }
}
