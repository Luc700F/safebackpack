// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { hashEmail, normaliseEmail } from './email-hash';

const SECRET = 'a-server-side-secret';

describe('normaliseEmail', () => {
  it.each([
    ['Luca@Example.com', 'luca@example.com'],
    ['  luca@example.com  ', 'luca@example.com'],
    ['LUCA@EXAMPLE.COM', 'luca@example.com'],
  ])('normalises %p to %p', (input, expected) => {
    expect(normaliseEmail(input)).toBe(expected);
  });
});

describe('hashEmail', () => {
  it('produces a 64-character hex digest', () => {
    expect(hashEmail('luca@example.com', SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same address', () => {
    expect(hashEmail('luca@example.com', SECRET)).toBe(
      hashEmail('luca@example.com', SECRET),
    );
  });

  it('treats differently written forms of one address as the same person', () => {
    expect(hashEmail('  Luca@Example.COM ', SECRET)).toBe(
      hashEmail('luca@example.com', SECRET),
    );
  });

  it('differs for different addresses', () => {
    expect(hashEmail('luca@example.com', SECRET)).not.toBe(
      hashEmail('other@example.com', SECRET),
    );
  });

  it('differs under a different secret, so one leak does not unlock others', () => {
    expect(hashEmail('luca@example.com', SECRET)).not.toBe(
      hashEmail('luca@example.com', 'another-secret'),
    );
  });

  it('never contains the address it was given', () => {
    expect(hashEmail('luca@example.com', SECRET)).not.toContain('luca');
  });

  it('refuses to work without a secret, rather than hashing weakly', () => {
    expect(() => hashEmail('luca@example.com', '')).toThrowError(
      /without a secret/,
    );
  });
});
