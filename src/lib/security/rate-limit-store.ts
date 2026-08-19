/**
 * Where rate limit counters live.
 *
 * The decision itself is a pure function in `rate-limit.ts`. This is only the
 * storage behind it, so the same rules run against memory in tests and against
 * Redis in production.
 */

import type { RateLimitState } from './rate-limit';

export interface RateLimitStore {
  read(key: string): Promise<RateLimitState | null>;
  write(key: string, state: RateLimitState, ttlMs: number): Promise<void>;
}

/** In-memory store. Fine for tests and a single local process, not for production. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<
    string,
    { state: RateLimitState; expiresAt: number }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  async read(key: string): Promise<RateLimitState | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (this.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    return entry.state;
  }

  async write(
    key: string,
    state: RateLimitState,
    ttlMs: number,
  ): Promise<void> {
    this.entries.set(key, { state, expiresAt: this.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
