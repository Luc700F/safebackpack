import { describe, expect, it } from 'vitest';

import { isSameOrigin } from './origin';

describe('isSameOrigin', () => {
  it('accepts a request from our own pages', () => {
    expect(
      isSameOrigin({
        origin: 'https://safebackpack.app',
        host: 'safebackpack.app',
      }),
    ).toBe(true);
  });

  it('accepts one on localhost, where the port is part of the host', () => {
    expect(
      isSameOrigin({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }),
    ).toBe(true);
  });

  it('rejects a request from somebody else’s page', () => {
    expect(
      isSameOrigin({ origin: 'https://evil.example', host: 'safebackpack.app' }),
    ).toBe(false);
  });

  it('rejects a lookalike subdomain', () => {
    expect(
      isSameOrigin({
        origin: 'https://safebackpack.app.evil.example',
        host: 'safebackpack.app',
      }),
    ).toBe(false);
  });

  it('rejects a different port on the same host', () => {
    expect(
      isSameOrigin({ origin: 'http://localhost:4000', host: 'localhost:3000' }),
    ).toBe(false);
  });

  it('allows a missing origin, which browsers omit on some same-site requests', () => {
    expect(isSameOrigin({ origin: null, host: 'safebackpack.app' })).toBe(true);
  });

  it('rejects when there is no host to compare against', () => {
    expect(isSameOrigin({ origin: 'https://safebackpack.app', host: null })).toBe(
      false,
    );
  });

  it.each([['garbage'], ['null'], ['//evil.example']])(
    'rejects the unparseable origin %p',
    (origin) => {
      expect(isSameOrigin({ origin, host: 'safebackpack.app' })).toBe(false);
    },
  );

  it('rejects a plain-http origin when the proxy says the site is https', () => {
    expect(
      isSameOrigin({
        origin: 'http://safebackpack.app',
        host: 'safebackpack.app',
        forwardedProtocol: 'https',
      }),
    ).toBe(false);
  });

  it('accepts the matching scheme when the proxy names one', () => {
    expect(
      isSameOrigin({
        origin: 'https://safebackpack.app',
        host: 'safebackpack.app',
        forwardedProtocol: 'https',
      }),
    ).toBe(true);
  });
});
