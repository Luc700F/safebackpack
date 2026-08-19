import { describe, expect, it } from 'vitest';

import {
  BASE_RETENTION_DAYS,
  CONFIRMATION_EXTENSION_DAYS,
  MAX_RETENTION_DAYS,
  daysUntilExpiry,
  expiresAt,
  isExpired,
  selectExpired,
} from './retention';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const PUBLISHED = new Date('2026-06-01T00:00:00.000Z');

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysAfter(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('the periods themselves', () => {
  it('gives an unconfirmed report two months', () => {
    expect(BASE_RETENTION_DAYS).toBe(60);
  });

  it('lets a confirmation buy another month', () => {
    expect(CONFIRMATION_EXTENSION_DAYS).toBe(30);
  });

  it('never lets a report outlive three months', () => {
    expect(MAX_RETENTION_DAYS).toBe(90);
  });
});

describe('expiresAt', () => {
  it('gives an unconfirmed report the base period', () => {
    expect(expiresAt(PUBLISHED).toISOString()).toBe(
      daysAfter(PUBLISHED, BASE_RETENTION_DAYS).toISOString(),
    );
  });

  it('counts a confirmation from when it was given, not from publication', () => {
    const confirmed = daysAfter(PUBLISHED, 50);

    expect(expiresAt(PUBLISHED, confirmed).toISOString()).toBe(
      daysAfter(confirmed, CONFIRMATION_EXTENSION_DAYS).toISOString(),
    );
  });

  it('ignores an early confirmation that would shorten the report', () => {
    // Confirmed on day 5: five plus thirty is well inside the base period.
    const confirmed = daysAfter(PUBLISHED, 5);

    expect(expiresAt(PUBLISHED, confirmed).toISOString()).toBe(
      daysAfter(PUBLISHED, BASE_RETENTION_DAYS).toISOString(),
    );
  });

  it('stops at the ceiling when a late confirmation would reach past it', () => {
    // Confirmed on day 80: plus thirty would be day 110.
    const confirmed = daysAfter(PUBLISHED, 80);

    expect(expiresAt(PUBLISHED, confirmed).toISOString()).toBe(
      daysAfter(PUBLISHED, MAX_RETENTION_DAYS).toISOString(),
    );
  });

  it('cannot be pushed past the ceiling by repeated confirmations', () => {
    for (const day of [61, 75, 89, 200]) {
      const expiry = expiresAt(PUBLISHED, daysAfter(PUBLISHED, day));

      expect(expiry.getTime()).toBeLessThanOrEqual(
        daysAfter(PUBLISHED, MAX_RETENTION_DAYS).getTime(),
      );
    }
  });

  it('treats a null confirmation as none at all', () => {
    expect(expiresAt(PUBLISHED, null).toISOString()).toBe(
      expiresAt(PUBLISHED).toISOString(),
    );
  });
});

describe('isExpired', () => {
  it('keeps a report published today', () => {
    expect(isExpired(NOW, NOW)).toBe(false);
  });

  it('keeps a report one day short of the base period', () => {
    expect(isExpired(daysBefore(BASE_RETENTION_DAYS - 1), NOW)).toBe(false);
  });

  it('expires an unconfirmed report exactly on the base period', () => {
    expect(isExpired(daysBefore(BASE_RETENTION_DAYS), NOW)).toBe(true);
  });

  it('keeps that same report alive if it was confirmed recently', () => {
    expect(
      isExpired(daysBefore(BASE_RETENTION_DAYS), NOW, daysBefore(10)),
    ).toBe(false);
  });

  it('expires it again once the confirmation itself is a month old', () => {
    expect(
      isExpired(daysBefore(BASE_RETENTION_DAYS), NOW, daysBefore(31)),
    ).toBe(true);
  });

  it('expires even a freshly confirmed report past the ceiling', () => {
    expect(isExpired(daysBefore(MAX_RETENTION_DAYS), NOW, daysBefore(1))).toBe(
      true,
    );
  });
});

describe('daysUntilExpiry', () => {
  it('counts down from the base period', () => {
    expect(daysUntilExpiry(NOW, NOW)).toBe(BASE_RETENTION_DAYS);
  });

  it('counts down from the confirmation once that is the later date', () => {
    expect(daysUntilExpiry(daysBefore(55), NOW, NOW)).toBe(
      CONFIRMATION_EXTENSION_DAYS,
    );
  });

  it('never exceeds the ceiling', () => {
    expect(daysUntilExpiry(NOW, NOW, NOW)).toBeLessThanOrEqual(
      MAX_RETENTION_DAYS,
    );
  });

  it('reaches zero on the day it leaves the map', () => {
    expect(daysUntilExpiry(daysBefore(BASE_RETENTION_DAYS), NOW)).toBe(0);
  });

  it('never goes negative for a long-overdue report', () => {
    expect(daysUntilExpiry(daysBefore(500), NOW)).toBe(0);
  });
});

describe('selectExpired', () => {
  it('returns only what the job must take off the map', () => {
    const reports = [
      { id: 'fresh', publishedAt: daysBefore(1) },
      { id: 'borderline', publishedAt: daysBefore(BASE_RETENTION_DAYS - 1) },
      { id: 'due', publishedAt: daysBefore(BASE_RETENTION_DAYS) },
      { id: 'overdue', publishedAt: daysBefore(365) },
    ];

    expect(selectExpired(reports, NOW).map((r) => r.id)).toEqual([
      'due',
      'overdue',
    ]);
  });

  it('spares a report a recent confirmation has kept alive', () => {
    const reports = [
      { id: 'unconfirmed', publishedAt: daysBefore(65) },
      {
        id: 'confirmed',
        publishedAt: daysBefore(65),
        lastConfirmedAt: daysBefore(5),
      },
    ];

    expect(selectExpired(reports, NOW).map((r) => r.id)).toEqual([
      'unconfirmed',
    ]);
  });

  it('still removes a confirmed report once the ceiling passes', () => {
    const reports = [
      { id: 'old', publishedAt: daysBefore(120), lastConfirmedAt: daysBefore(1) },
    ];

    expect(selectExpired(reports, NOW).map((r) => r.id)).toEqual(['old']);
  });

  it('handles an empty input', () => {
    expect(selectExpired([], NOW)).toEqual([]);
  });
});
