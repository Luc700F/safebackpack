// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { UpstashRateLimitStore } from './upstash-rate-limit-store';

const OPTIONS = { url: 'https://example.upstash.io', token: 'a-token' };
const STATE = { count: 2, windowStart: 1_700_000_000_000 };

function respond(result: unknown) {
  return new Response(JSON.stringify({ result }), { status: 200 });
}

function store(fetchImpl: unknown) {
  return new UpstashRateLimitStore({
    ...OPTIONS,
    fetchImpl: fetchImpl as typeof fetch,
  });
}

describe('construction', () => {
  it.each([
    [{ url: '', token: 'a' }],
    [{ url: 'https://x', token: '' }],
  ])('refuses to exist without complete credentials: %p', (options) => {
    expect(() => new UpstashRateLimitStore(options)).toThrowError(
      /without a URL and token/,
    );
  });

  it('tolerates a trailing slash on the URL', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe('https://example.upstash.io');
      return respond(null);
    });

    await new UpstashRateLimitStore({
      ...OPTIONS,
      url: 'https://example.upstash.io/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).read('key');

    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe('read', () => {
  it('returns the stored counter', async () => {
    await expect(
      store(async () => respond(JSON.stringify(STATE))).read('key'),
    ).resolves.toEqual(STATE);
  });

  it('authenticates with the token', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => respond(null),
    );
    await store(fetchImpl).read('key');

    const headers = fetchImpl.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer a-token');
  });

  it('keeps its keys in their own namespace', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))).toEqual(['GET', 'sb:rl:key']);
        return respond(null);
      },
    );

    await store(fetchImpl).read('key');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('returns null for a key that was never written', async () => {
    await expect(store(async () => respond(null)).read('key')).resolves.toBeNull();
  });

  it.each([['not json'], ['{"count":"many"}'], ['{}'], ['[]']])(
    'treats the unusable value %p as absent rather than trusting it',
    async (value) => {
      await expect(store(async () => respond(value)).read('key')).resolves.toBeNull();
    },
  );

  it('fails open when the store cannot be reached', async () => {
    await expect(
      store(async () => {
        throw new Error('ECONNREFUSED');
      }).read('key'),
    ).resolves.toBeNull();
  });

  it('fails open when the store answers with an error', async () => {
    await expect(
      store(async () => new Response('nope', { status: 500 })).read('key'),
    ).resolves.toBeNull();
  });
});

describe('write', () => {
  it('stores the counter with an expiry in whole seconds', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))).toEqual([
          'SET',
          'sb:rl:key',
          JSON.stringify(STATE),
          'EX',
          '60',
        ]);
        return respond('OK');
      },
    );

    await store(fetchImpl).write('key', STATE, 60_000);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('rounds a fractional second up, never down to zero', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))[4]).toBe('1');
        return respond('OK');
      },
    );

    await store(fetchImpl).write('key', STATE, 10);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('does not throw when the store is unreachable', async () => {
    await expect(
      store(async () => {
        throw new Error('down');
      }).write('key', STATE, 1000),
    ).resolves.toBeUndefined();
  });
});
