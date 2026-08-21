/**
 * Rate limit counters in Upstash Redis.
 *
 * The in-memory store cannot work in production. Vercel runs each request in a
 * short-lived instance with its own memory, so a counter written by one is
 * invisible to the next: "three reports per address per day" becomes no limit
 * at all. Counters have to live somewhere every instance can see.
 *
 * Upstash speaks HTTP rather than the Redis wire protocol, which is what makes
 * it usable from a serverless function at all — there is no connection to keep
 * open and nothing to pool.
 *
 * A store that cannot be reached fails **open**: a rate limiter having a bad
 * day must not stop people reporting a robbery. That is a deliberate trade,
 * and the wrong one for a store guarding money rather than a map.
 */

import type { RateLimitState } from './rate-limit';
import type { RateLimitStore } from './rate-limit-store';

const TIMEOUT_MS = 2000;

export interface UpstashOptions {
  url: string;
  token: string;
  /** Injectable so tests never reach the network. */
  fetchImpl?: typeof fetch;
}

export class UpstashRateLimitStore implements RateLimitStore {
  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: UpstashOptions) {
    if (!options.url || !options.token) {
      throw new Error('Refusing to build an Upstash store without a URL and token');
    }

    this.url = options.url.replace(/\/$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async read(key: string): Promise<RateLimitState | null> {
    const result = await this.command(['GET', namespaced(key)]);
    if (typeof result !== 'string') return null;

    try {
      const parsed = JSON.parse(result) as RateLimitState;

      // A value we cannot make sense of is treated as absent rather than
      // trusted: a corrupt counter must not lock somebody out forever.
      return Number.isFinite(parsed?.count) && Number.isFinite(parsed?.windowStart)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  async write(key: string, state: RateLimitState, ttlMs: number): Promise<void> {
    // Expiry is the store's own job: a window that has passed should vanish
    // rather than accumulate, and nothing else ever deletes these keys.
    await this.command([
      'SET',
      namespaced(key),
      JSON.stringify(state),
      'EX',
      String(Math.max(1, Math.ceil(ttlMs / 1000))),
    ]);
  }

  private async command(parts: string[]): Promise<unknown> {
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parts),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return null;

      const body = (await response.json()) as { result?: unknown };
      return body?.result ?? null;
    } catch {
      // Unreachable or slow: see the note at the top about failing open.
      return null;
    }
  }
}

/** Keeps these keys apart from anything else sharing the database. */
function namespaced(key: string): string {
  return `sb:rl:${key}`;
}
