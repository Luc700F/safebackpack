/**
 * Applies the rules in `rate-limit.ts` against a store.
 */

import { type RateLimitRule, consume } from './rate-limit';
import type { RateLimitStore } from './rate-limit-store';

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private readonly store: RateLimitStore;
  private readonly clock: () => Date;

  constructor(store: RateLimitStore, clock: () => Date = () => new Date()) {
    this.store = store;
    this.clock = clock;
  }

  async check(
    key: string,
    rule: RateLimitRule,
  ): Promise<RateLimitOutcome> {
    const now = this.clock();
    const previous = await this.store.read(key);
    const decision = consume(previous, rule, now);

    // The window is persisted even for a rejected attempt, so the counter does
    // not reset itself by being hammered.
    await this.store.write(key, decision.state, rule.windowMs);

    return {
      allowed: decision.allowed,
      remaining: decision.remaining,
      retryAfterMs: decision.retryAfterMs,
    };
  }
}
