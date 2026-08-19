// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { SealedValueError, open, seal } from './secret-box';

const SECRET = 'a-server-side-secret';
const EMAIL = 'traveller@example.com';

describe('seal and open', () => {
  it('returns the original value', () => {
    expect(open(seal(EMAIL, SECRET), SECRET)).toBe(EMAIL);
  });

  it('handles an empty string', () => {
    expect(open(seal('', SECRET), SECRET)).toBe('');
  });

  it('handles non-ASCII characters', () => {
    const value = 'zoë.müller+reisen@example.co.jp';
    expect(open(seal(value, SECRET), SECRET)).toBe(value);
  });
});

describe('seal', () => {
  it('never contains the plaintext', () => {
    const sealed = seal(EMAIL, SECRET);
    expect(sealed.toString('utf8')).not.toContain('traveller');
    expect(sealed.toString('utf8')).not.toContain('example.com');
  });

  it('produces a different ciphertext every time', () => {
    const first = seal(EMAIL, SECRET).toString('base64');
    const second = seal(EMAIL, SECRET).toString('base64');
    expect(first).not.toBe(second);
  });

  it('refuses to work without a secret', () => {
    expect(() => seal(EMAIL, '')).toThrowError(/without a secret/);
  });
});

describe('open', () => {
  it('refuses a value sealed with a different secret', () => {
    expect(() => open(seal(EMAIL, SECRET), 'another-secret')).toThrowError(
      SealedValueError,
    );
  });

  it('detects a ciphertext that was altered', () => {
    const sealed = seal(EMAIL, SECRET);
    sealed[sealed.length - 1] ^= 0xff;

    expect(() => open(sealed, SECRET)).toThrowError(SealedValueError);
  });

  it('detects an altered authentication tag', () => {
    const sealed = seal(EMAIL, SECRET);
    sealed[13] ^= 0xff;

    expect(() => open(sealed, SECRET)).toThrowError(SealedValueError);
  });

  it('detects an altered initialisation vector', () => {
    const sealed = seal(EMAIL, SECRET);
    sealed[0] ^= 0xff;

    expect(() => open(sealed, SECRET)).toThrowError(SealedValueError);
  });

  it.each([[0], [5], [27]])('rejects a value of %i bytes as too short', (size) => {
    expect(() => open(Buffer.alloc(size), SECRET)).toThrowError(
      /too short to be valid/,
    );
  });

  it('never puts the secret into the error message', () => {
    try {
      open(seal(EMAIL, SECRET), 'another-secret');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('another-secret');
      expect((error as Error).message).not.toContain(SECRET);
    }
  });
});
