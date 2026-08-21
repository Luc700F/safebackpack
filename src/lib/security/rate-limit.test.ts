import { describe, expect, it } from 'vitest';

import {
  ADMIN_SIGN_IN_PER_IP_PER_HOUR,
  REPORTS_PER_EMAIL_PER_DAY,
  REPORTS_PER_IP_PER_DAY,
  type RateLimitState,
  VERIFICATIONS_PER_EMAIL_PER_HOUR,
  consume,
} from './rate-limit';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const RULE = { limit: 3, windowMs: 60_000 };

function minutesLater(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

describe('rules', () => {
  it('lets one address file three reports a day', () => {
    expect(REPORTS_PER_EMAIL_PER_DAY.limit).toBe(3);
  });

  it('is more generous per network address, for shared hostel wifi', () => {
    expect(REPORTS_PER_IP_PER_DAY.limit).toBeGreaterThan(
      REPORTS_PER_EMAIL_PER_DAY.limit,
    );
  });

  it('caps verification emails to limit inbox flooding', () => {
    expect(VERIFICATIONS_PER_EMAIL_PER_HOUR.limit).toBe(5);
  });
});

describe('consume', () => {
  it('allows the first attempt and opens a window', () => {
    const decision = consume(null, RULE, NOW);

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(2);
    expect(decision.state).toEqual({ count: 1, windowStart: NOW.getTime() });
  });

  it('allows exactly the configured number of attempts', () => {
    let state: RateLimitState | null = null;

    for (let attempt = 1; attempt <= RULE.limit; attempt += 1) {
      const decision = consume(state, RULE, NOW);
      expect(decision.allowed).toBe(true);
      state = decision.state;
    }

    expect(consume(state, RULE, NOW).allowed).toBe(false);
  });

  it('reports how long the caller must wait', () => {
    const state = { count: RULE.limit, windowStart: NOW.getTime() };
    const decision = consume(state, RULE, new Date(NOW.getTime() + 20_000));

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterMs).toBe(40_000);
  });

  it('does not extend the window when an attempt is rejected', () => {
    const state = { count: RULE.limit, windowStart: NOW.getTime() };

    const first = consume(state, RULE, new Date(NOW.getTime() + 10_000));
    const second = consume(first.state, RULE, new Date(NOW.getTime() + 20_000));

    expect(second.state.windowStart).toBe(NOW.getTime());
    expect(second.retryAfterMs).toBeLessThan(first.retryAfterMs);
  });

  it('opens a fresh window once the old one has passed', () => {
    const exhausted = { count: RULE.limit, windowStart: NOW.getTime() };
    const decision = consume(exhausted, RULE, minutesLater(1));

    expect(decision.allowed).toBe(true);
    expect(decision.state.count).toBe(1);
    expect(decision.state.windowStart).toBe(minutesLater(1).getTime());
  });

  it('leaves the caller-supplied state untouched', () => {
    const state = { count: 1, windowStart: NOW.getTime() };
    consume(state, RULE, NOW);
    expect(state).toEqual({ count: 1, windowStart: NOW.getTime() });
  });

  it('never reports a negative wait', () => {
    const state = { count: RULE.limit, windowStart: NOW.getTime() };
    const decision = consume(state, RULE, minutesLater(0.999));
    expect(decision.retryAfterMs).toBeGreaterThanOrEqual(0);
  });
});

describe('moderation sign-in', () => {
  it('leaves room for a person with a typo on two devices', () => {
    expect(ADMIN_SIGN_IN_PER_IP_PER_HOUR.limit).toBeGreaterThanOrEqual(20);
  });

  it('stays far below anything useful for guessing', () => {
    expect(ADMIN_SIGN_IN_PER_IP_PER_HOUR.limit).toBeLessThanOrEqual(50);
    expect(ADMIN_SIGN_IN_PER_IP_PER_HOUR.windowMs).toBe(60 * 60 * 1000);
  });
});
