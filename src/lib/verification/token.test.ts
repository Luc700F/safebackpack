import { describe, expect, it } from 'vitest';

import {
  TOKEN_TTL_MINUTES,
  createVerificationToken,
  hashToken,
  isTokenExpired,
  matchesTokenHash,
} from './token';

const NOW = new Date('2026-08-19T12:00:00.000Z');

describe('createVerificationToken', () => {
  it('issues a token, its hash and an expiry', () => {
    const issued = createVerificationToken(NOW);

    expect(issued.token.length).toBeGreaterThanOrEqual(32);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.expiresAt.toISOString()).toBe('2026-08-19T12:30:00.000Z');
  });

  it('never repeats a token', () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => createVerificationToken(NOW).token),
    );
    expect(tokens.size).toBe(200);
  });

  it('uses URL-safe characters so the email link cannot break', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(createVerificationToken(NOW).token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('does not expose the raw token through its hash', () => {
    const issued = createVerificationToken(NOW);
    expect(issued.tokenHash).not.toContain(issued.token);
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('differs for different tokens', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('matchesTokenHash', () => {
  it('accepts the token it was issued for', () => {
    const issued = createVerificationToken(NOW);
    expect(matchesTokenHash(issued.token, issued.tokenHash)).toBe(true);
  });

  it('rejects a different token', () => {
    const issued = createVerificationToken(NOW);
    const other = createVerificationToken(NOW);
    expect(matchesTokenHash(other.token, issued.tokenHash)).toBe(false);
  });

  it('rejects a token with one character changed', () => {
    const issued = createVerificationToken(NOW);
    const tampered = `${issued.token.slice(0, -1)}${
      issued.token.endsWith('A') ? 'B' : 'A'
    }`;
    expect(matchesTokenHash(tampered, issued.tokenHash)).toBe(false);
  });

  it.each([[''], ['not-hex'], ['abc'], [null], [undefined], [42]])(
    'returns false rather than throwing for stored hash %p',
    (storedHash) => {
      expect(matchesTokenHash('token', storedHash as string)).toBe(false);
    },
  );

  it.each([[null], [undefined], [42], [{}]])(
    'returns false rather than throwing for token %p',
    (token) => {
      const issued = createVerificationToken(NOW);
      expect(matchesTokenHash(token as string, issued.tokenHash)).toBe(false);
    },
  );
});

describe('isTokenExpired', () => {
  it('accepts a token inside its lifetime', () => {
    const issued = createVerificationToken(NOW);
    const later = new Date(NOW.getTime() + 5 * 60 * 1000);
    expect(isTokenExpired(issued.expiresAt, later)).toBe(false);
  });

  it('rejects a token exactly at its expiry', () => {
    const issued = createVerificationToken(NOW);
    expect(isTokenExpired(issued.expiresAt, issued.expiresAt)).toBe(true);
  });

  it('rejects a token past its expiry', () => {
    const issued = createVerificationToken(NOW);
    const later = new Date(NOW.getTime() + (TOKEN_TTL_MINUTES + 1) * 60 * 1000);
    expect(isTokenExpired(issued.expiresAt, later)).toBe(true);
  });
});
