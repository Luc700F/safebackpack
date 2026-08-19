import { describe, expect, it } from 'vitest';

import {
  RECOGNITION_DAYS,
  createRecognitionToken,
  readRecognitionToken,
} from './recognition';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const SECRET = 'test-secret-value';
const EMAIL_HASH = 'a'.repeat(64);

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('createRecognitionToken', () => {
  it('carries the email hash, an expiry and a signature', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    expect(token.split('.')).toHaveLength(3);
  });

  it('refuses to sign without a secret', () => {
    expect(() => createRecognitionToken(EMAIL_HASH, '', NOW)).toThrowError(
      /without a secret/,
    );
  });
});

describe('readRecognitionToken', () => {
  it('recognises a fresh token', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    expect(readRecognitionToken(token, SECRET, NOW)?.emailHash).toBe(EMAIL_HASH);
  });

  it('still recognises the token one day before it lapses', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    expect(
      readRecognitionToken(token, SECRET, daysLater(RECOGNITION_DAYS - 1)),
    ).not.toBeNull();
  });

  it('stops recognising the token after 30 days', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    expect(
      readRecognitionToken(token, SECRET, daysLater(RECOGNITION_DAYS)),
    ).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    expect(readRecognitionToken(token, 'other-secret', NOW)).toBeNull();
  });

  it('rejects a token whose email hash was swapped', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    const [, expiry, signature] = token.split('.');
    const forged = ['b'.repeat(64), expiry, signature].join('.');
    expect(readRecognitionToken(forged, SECRET, NOW)).toBeNull();
  });

  it('rejects a token whose expiry was pushed into the future', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    const [hash, , signature] = token.split('.');
    const forged = [hash, String(daysLater(3650).getTime()), signature].join('.');
    expect(readRecognitionToken(forged, SECRET, NOW)).toBeNull();
  });

  it.each([[''], ['a.b'], ['a.b.c.d'], ['garbage'], [null], [undefined], [42]])(
    'returns null rather than throwing for %p',
    (value) => {
      expect(readRecognitionToken(value, SECRET, NOW)).toBeNull();
    },
  );

  it('returns null when no secret is configured', () => {
    const token = createRecognitionToken(EMAIL_HASH, SECRET, NOW);
    expect(readRecognitionToken(token, '', NOW)).toBeNull();
  });
});
