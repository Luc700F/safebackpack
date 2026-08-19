// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryRateLimitStore } from './rate-limit-store';
import { RateLimiter } from './rate-limiter';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const RULE = { limit: 2, windowMs: 60_000 };

let clock: Date;
let store: MemoryRateLimitStore;
let limiter: RateLimiter;

beforeEach(() => {
  clock = new Date(NOW);
  store = new MemoryRateLimitStore(() => clock.getTime());
  limiter = new RateLimiter(store, () => clock);
});

describe('RateLimiter', () => {
  it('allows attempts up to the limit', async () => {
    expect((await limiter.check('key', RULE)).allowed).toBe(true);
    expect((await limiter.check('key', RULE)).allowed).toBe(true);
    expect((await limiter.check('key', RULE)).allowed).toBe(false);
  });

  it('counts each key separately', async () => {
    await limiter.check('a', RULE);
    await limiter.check('a', RULE);

    expect((await limiter.check('b', RULE)).allowed).toBe(true);
  });

  it('counts down the remaining attempts', async () => {
    expect((await limiter.check('key', RULE)).remaining).toBe(1);
    expect((await limiter.check('key', RULE)).remaining).toBe(0);
  });

  it('says how long to wait once the limit is hit', async () => {
    await limiter.check('key', RULE);
    await limiter.check('key', RULE);

    const outcome = await limiter.check('key', RULE);
    expect(outcome.retryAfterMs).toBeGreaterThan(0);
    expect(outcome.retryAfterMs).toBeLessThanOrEqual(RULE.windowMs);
  });

  it('cannot be reset by hammering it', async () => {
    await limiter.check('key', RULE);
    await limiter.check('key', RULE);

    clock = new Date(NOW.getTime() + 30_000);
    await limiter.check('key', RULE);
    await limiter.check('key', RULE);

    clock = new Date(NOW.getTime() + 59_000);
    expect((await limiter.check('key', RULE)).allowed).toBe(false);
  });

  it('opens a new window once the old one has passed', async () => {
    await limiter.check('key', RULE);
    await limiter.check('key', RULE);

    clock = new Date(NOW.getTime() + 61_000);
    expect((await limiter.check('key', RULE)).allowed).toBe(true);
  });
});

describe('MemoryRateLimitStore', () => {
  it('returns nothing for an unseen key', async () => {
    expect(await store.read('unseen')).toBeNull();
  });

  it('forgets an entry once its lifetime has passed', async () => {
    await store.write('key', { count: 1, windowStart: NOW.getTime() }, 1000);

    clock = new Date(NOW.getTime() + 1001);
    expect(await store.read('key')).toBeNull();
  });

  it('keeps an entry that is still within its lifetime', async () => {
    await store.write('key', { count: 1, windowStart: NOW.getTime() }, 1000);

    clock = new Date(NOW.getTime() + 999);
    expect(await store.read('key')).toEqual({
      count: 1,
      windowStart: NOW.getTime(),
    });
  });

  it('clears everything on demand', async () => {
    await store.write('key', { count: 1, windowStart: NOW.getTime() }, 1000);
    store.clear();
    expect(await store.read('key')).toBeNull();
  });
});
