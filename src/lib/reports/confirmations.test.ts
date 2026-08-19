import { describe, expect, it } from 'vitest';

import {
  CLOSURE_THRESHOLD,
  type Confirmation,
  canConfirm,
  summarise,
} from './confirmations';

const REPORTER = 'a'.repeat(64);
const CONFIRMER = 'b'.repeat(64);
const NOW = new Date('2026-08-19T12:00:00.000Z');

function published(overrides = {}) {
  return { status: 'published' as const, reporterEmailHash: REPORTER, ...overrides };
}

function confirmation(overrides: Partial<Confirmation> = {}): Confirmation {
  return {
    reportId: 'report-1',
    confirmerEmailHash: CONFIRMER,
    kind: 'still_valid',
    createdAt: NOW,
    ...overrides,
  };
}

describe('canConfirm', () => {
  it('lets another traveller confirm a published report', () => {
    expect(canConfirm(published(), CONFIRMER, [])).toEqual({ allowed: true });
  });

  it.each([
    ['pending_verification'],
    ['screening'],
    ['held_for_review'],
    ['rejected'],
  ])('refuses a report in status %s', (status) => {
    expect(
      canConfirm(published({ status }), CONFIRMER, []),
    ).toEqual({ allowed: false, reason: 'report_not_published' });
  });

  it('refuses the reporter vouching for themselves', () => {
    expect(canConfirm(published(), REPORTER, [])).toEqual({
      allowed: false,
      reason: 'own_report',
    });
  });

  it('refuses a second confirmation from the same person', () => {
    expect(
      canConfirm(published(), CONFIRMER, [confirmation()]),
    ).toEqual({ allowed: false, reason: 'already_confirmed' });
  });

  it('refuses a repeat even when the person changes their mind', () => {
    const check = canConfirm(published(), CONFIRMER, [
      confirmation({ kind: 'no_longer_valid' }),
    ]);
    expect(check).toEqual({ allowed: false, reason: 'already_confirmed' });
  });

  it('is unaffected by other people having confirmed', () => {
    const others = [
      confirmation({ confirmerEmailHash: 'c'.repeat(64) }),
      confirmation({ confirmerEmailHash: 'd'.repeat(64) }),
    ];
    expect(canConfirm(published(), CONFIRMER, others)).toEqual({
      allowed: true,
    });
  });
});

describe('summarise', () => {
  it('counts nothing for a report nobody has touched', () => {
    expect(summarise([])).toEqual({
      stillValid: 0,
      noLongerValid: 0,
      shouldRetire: false,
    });
  });

  it('counts both kinds separately', () => {
    const confirmations = [
      confirmation({ confirmerEmailHash: '1'.repeat(64) }),
      confirmation({ confirmerEmailHash: '2'.repeat(64) }),
      confirmation({
        confirmerEmailHash: '3'.repeat(64),
        kind: 'no_longer_valid',
      }),
    ];

    expect(summarise(confirmations)).toMatchObject({
      stillValid: 2,
      noLongerValid: 1,
    });
  });

  it('does not retire a report on one dissenting voice', () => {
    expect(
      summarise([confirmation({ kind: 'no_longer_valid' })]).shouldRetire,
    ).toBe(false);
  });

  it('retires a report once the threshold is reached', () => {
    const confirmations = Array.from({ length: CLOSURE_THRESHOLD }, (_, i) =>
      confirmation({
        confirmerEmailHash: String(i).repeat(64),
        kind: 'no_longer_valid',
      }),
    );

    expect(summarise(confirmations).shouldRetire).toBe(true);
  });

  it('retires it regardless of how many said it still applied', () => {
    const confirmations = [
      ...Array.from({ length: 10 }, (_, i) =>
        confirmation({ confirmerEmailHash: `s${i}`.repeat(20) }),
      ),
      ...Array.from({ length: CLOSURE_THRESHOLD }, (_, i) =>
        confirmation({
          confirmerEmailHash: `n${i}`.repeat(20),
          kind: 'no_longer_valid',
        }),
      ),
    ];

    expect(summarise(confirmations).shouldRetire).toBe(true);
  });

  it('needs more than one person, so nobody can silence a report alone', () => {
    expect(CLOSURE_THRESHOLD).toBeGreaterThan(1);
  });
});
