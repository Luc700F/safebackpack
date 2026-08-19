// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { hashClientAddress, readClientAddress } from './client-address';

const SECRET = 'a-server-side-secret';

function headers(values: Record<string, string>) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

describe('readClientAddress', () => {
  it('reads a single forwarded address', () => {
    expect(readClientAddress(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe(
      '203.0.113.7',
    );
  });

  it('trusts only the first entry, which the platform prepends', () => {
    expect(
      readClientAddress(
        headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 192.168.1.1' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('ignores an address a client tried to inject after its own', () => {
    const forged = '203.0.113.7, 1.1.1.1';
    expect(readClientAddress(headers({ 'x-forwarded-for': forged }))).not.toBe(
      '1.1.1.1',
    );
  });

  it('tolerates the whitespace proxies leave behind', () => {
    expect(
      readClientAddress(headers({ 'x-forwarded-for': '  203.0.113.7 , 10.0.0.1' })),
    ).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    expect(readClientAddress(headers({ 'x-real-ip': '203.0.113.9' }))).toBe(
      '203.0.113.9',
    );
  });

  it('prefers the forwarded header when both are present', () => {
    expect(
      readClientAddress(
        headers({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.9' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('returns null when no proxy header is present', () => {
    expect(readClientAddress(headers({}))).toBeNull();
  });

  it('returns null for an empty header rather than an empty address', () => {
    expect(readClientAddress(headers({ 'x-forwarded-for': '   ' }))).toBeNull();
  });
});

describe('hashClientAddress', () => {
  it('produces a hex digest', () => {
    expect(hashClientAddress('203.0.113.7', SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for one address', () => {
    expect(hashClientAddress('203.0.113.7', SECRET)).toBe(
      hashClientAddress('203.0.113.7', SECRET),
    );
  });

  it('differs between addresses', () => {
    expect(hashClientAddress('203.0.113.7', SECRET)).not.toBe(
      hashClientAddress('203.0.113.8', SECRET),
    );
  });

  it('never contains the address', () => {
    expect(hashClientAddress('203.0.113.7', SECRET)).not.toContain('203');
  });

  it('is not reversible with a public rainbow table, being keyed', () => {
    expect(hashClientAddress('203.0.113.7', SECRET)).not.toBe(
      hashClientAddress('203.0.113.7', 'different-secret'),
    );
  });

  it('puts unknown callers in one shared bucket, tightening the limit', () => {
    expect(hashClientAddress(null, SECRET)).toBe(hashClientAddress(null, SECRET));
  });

  it('refuses to work without a secret', () => {
    expect(() => hashClientAddress('203.0.113.7', '')).toThrowError(
      /without a secret/,
    );
  });
});
