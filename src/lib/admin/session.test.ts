// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION_HOURS,
  createAdminSession,
  hasAdminSession,
  isCorrectPassword,
} from './session';

const SECRET = 'a-server-side-secret';
const NOW = new Date('2026-08-20T12:00:00.000Z');
const PASSWORD = 'a-long-moderation-password';

function hoursLater(hours: number): Date {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000);
}

describe('isCorrectPassword', () => {
  it('accepts the configured password', () => {
    expect(isCorrectPassword(PASSWORD, PASSWORD)).toBe(true);
  });

  it('rejects a wrong password of the same length', () => {
    expect(isCorrectPassword('a-long-moderation-passworX', PASSWORD)).toBe(false);
  });

  it('rejects a password that is only a prefix', () => {
    expect(isCorrectPassword('a-long', PASSWORD)).toBe(false);
  });

  it('keeps the door shut when none is configured', () => {
    expect(isCorrectPassword(PASSWORD, undefined)).toBe(false);
    expect(isCorrectPassword(PASSWORD, '')).toBe(false);
  });

  it.each([[''], [null], [undefined], [42], [{}]])(
    'rejects the malformed attempt %p',
    (provided) => {
      expect(isCorrectPassword(provided, PASSWORD)).toBe(false);
    },
  );
});

describe('createAdminSession', () => {
  it('produces a token in three parts', () => {
    expect(createAdminSession(SECRET, NOW).split('.')).toHaveLength(3);
  });

  it('refuses to sign without a secret', () => {
    expect(() => createAdminSession('', NOW)).toThrowError(/without a secret/);
  });
});

describe('hasAdminSession', () => {
  it('recognises a fresh session', () => {
    expect(hasAdminSession(createAdminSession(SECRET, NOW), SECRET, NOW)).toBe(
      true,
    );
  });

  it('still recognises it an hour before it lapses', () => {
    const token = createAdminSession(SECRET, NOW);
    expect(hasAdminSession(token, SECRET, hoursLater(ADMIN_SESSION_HOURS - 1))).toBe(
      true,
    );
  });

  it('stops recognising it once it has lapsed', () => {
    const token = createAdminSession(SECRET, NOW);
    expect(hasAdminSession(token, SECRET, hoursLater(ADMIN_SESSION_HOURS))).toBe(
      false,
    );
  });

  it('rejects a session signed with a different secret', () => {
    expect(
      hasAdminSession(createAdminSession(SECRET, NOW), 'another-secret', NOW),
    ).toBe(false);
  });

  it('rejects a token whose expiry was pushed into the future', () => {
    const [label, , signature] = createAdminSession(SECRET, NOW).split('.');
    const forged = [label, String(hoursLater(1000).getTime()), signature].join('.');

    expect(hasAdminSession(forged, SECRET, NOW)).toBe(false);
  });

  it('does not accept a reporter recognition token as a moderation session', () => {
    // Both are signed with the same secret; only the label and the derived key
    // keep them apart, which is exactly what domain separation is for.
    const reporterish = ['a'.repeat(64), String(hoursLater(1).getTime()), 'x'].join('.');

    expect(hasAdminSession(reporterish, SECRET, NOW)).toBe(false);
  });

  it.each([[''], ['a.b'], ['a.b.c.d'], ['garbage'], [null], [undefined], [42]])(
    'returns false for %p rather than throwing',
    (token) => {
      expect(hasAdminSession(token, SECRET, NOW)).toBe(false);
    },
  );

  it('returns false when no secret is configured', () => {
    expect(hasAdminSession(createAdminSession(SECRET, NOW), '', NOW)).toBe(false);
  });
});
