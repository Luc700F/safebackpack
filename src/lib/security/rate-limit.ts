/**
 * Fixed-window rate limiting, expressed as pure functions.
 *
 * Keeping the decision separate from the storage means the same rules can be
 * unit-tested in memory today and backed by Redis in production without the
 * logic changing.
 */

export interface RateLimitRule {
  /** How many attempts are allowed inside one window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitState {
  count: number;
  /** Epoch milliseconds at which the current window opened. */
  windowStart: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the window resets. Zero when a slot is free. */
  retryAfterMs: number;
  /** State to persist for the next call. */
  state: RateLimitState;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reports one address may file per day. */
export const REPORTS_PER_EMAIL_PER_DAY: RateLimitRule = {
  limit: 3,
  windowMs: DAY_MS,
};

/** Reports one network address may file per day. */
export const REPORTS_PER_IP_PER_DAY: RateLimitRule = {
  limit: 10,
  windowMs: DAY_MS,
};

/** Confirmations one person may give per day, across all reports. */
export const CONFIRMATIONS_PER_PERSON_PER_DAY: RateLimitRule = {
  limit: 20,
  windowMs: DAY_MS,
};

/** Place searches one network address may make per minute, while typing. */
export const PLACE_SEARCHES_PER_IP_PER_MINUTE: RateLimitRule = {
  limit: 40,
  windowMs: 60 * 1000,
};

/**
 * Moderation sign-in attempts per network address per hour.
 *
 * Enough headroom for one person with a typo on two devices, and nowhere near
 * enough to guess a password of any length: twenty-five tries an hour against
 * even a short passphrase is a wait measured in centuries. The first value
 * tried was ten, which the end-to-end suite exhausted on its own — a limit
 * that trips on ordinary use gets raised, and a limit that trips on guessing
 * is doing its job.
 */
export const ADMIN_SIGN_IN_PER_IP_PER_HOUR: RateLimitRule = {
  limit: 25,
  windowMs: 60 * 60 * 1000,
};

/**
 * Flags one network address may raise per day. Generous, because flagging is
 * open to anyone and a reader working through a bad afternoon on the map is
 * doing exactly what we want.
 */
export const FLAGS_PER_IP_PER_DAY: RateLimitRule = {
  limit: 20,
  windowMs: DAY_MS,
};

/** Verification emails one address may trigger per hour. */
export const VERIFICATIONS_PER_EMAIL_PER_HOUR: RateLimitRule = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

/**
 * Records one attempt against a rule.
 *
 * A rejected attempt does **not** extend the window: hammering the endpoint
 * cannot lock a legitimate user out for longer than the window itself.
 */
export function consume(
  previous: RateLimitState | null,
  rule: RateLimitRule,
  now: Date = new Date(),
): RateLimitDecision {
  const timestamp = now.getTime();
  const isNewWindow =
    previous === null || timestamp - previous.windowStart >= rule.windowMs;

  const state: RateLimitState = isNewWindow
    ? { count: 0, windowStart: timestamp }
    : { ...previous };

  const resetsAt = state.windowStart + rule.windowMs;

  if (state.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, resetsAt - timestamp),
      state,
    };
  }

  state.count += 1;

  return {
    allowed: true,
    remaining: rule.limit - state.count,
    retryAfterMs: 0,
    state,
  };
}
