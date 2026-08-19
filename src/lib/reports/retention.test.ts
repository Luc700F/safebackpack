import { describe, expect, it } from 'vitest';

import {
  BASE_RETENTION_DAYS,
  CONFIRMATIONS_TO_MAXIMUM,
  CONFIRMATION_EXTENSION_DAYS,
  MAX_RETENTION_DAYS,
  daysUntilExpiry,
  expiresAt,
  isExpired,
  selectExpired,
} from './retention';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const PUBLISHED = new Date('2026-01-01T00:00:00.000Z');

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysAfter(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe('the periods themselves', () => {
  it('starts every report at one month', () => {
    expect(BASE_RETENTION_DAYS).toBe(30);
  });

  it('never lets a report outlive three months', () => {
    expect(MAX_RETENTION_DAYS).toBe(90);
    expect(MAX_RETENTION_DAYS).toBeGreaterThan(BASE_RETENTION_DAYS);
  });

  it('reaches the ceiling after two confirmations', () => {
    expect(CONFIRMATIONS_TO_MAXIMUM).toBe(2);
  });
});

describe('expiresAt', () => {
  it('gives an unconfirmed report the base period', () => {
    expect(expiresAt(PUBLISHED).toISOString()).toBe(
      daysAfter(PUBLISHED, BASE_RETENTION_DAYS),
    );
  });

  it('adds a month for one confirmation', () => {
    expect(expiresAt(PUBLISHED, 1).toISOString()).toBe(
      daysAfter(PUBLISHED, BASE_RETENTION_DAYS + CONFIRMATION_EXTENSION_DAYS),
    );
  });

  it('stops at the ceiling however often it is confirmed', () => {
    for (const count of [2, 3, 50, 10_000]) {
      expect(expiresAt(PUBLISHED, count).toISOString()).toBe(
        daysAfter(PUBLISHED, MAX_RETENTION_DAYS),
      );
    }
  });

  it.each([[-1], [-100]])('ignores a negative count of %p', (count) => {
    expect(expiresAt(PUBLISHED, count).toISOString()).toBe(
      daysAfter(PUBLISHED, BASE_RETENTION_DAYS),
    );
  });

  it('ignores a fractional count rather than granting part of a month', () => {
    expect(expiresAt(PUBLISHED, 1.9).toISOString()).toBe(
      expiresAt(PUBLISHED, 1).toISOString(),
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

  it('deletes an unconfirmed report exactly on the base period', () => {
    expect(isExpired(daysBefore(BASE_RETENTION_DAYS), NOW)).toBe(true);
  });

  it('keeps that same report alive once it has been confirmed', () => {
    expect(isExpired(daysBefore(BASE_RETENTION_DAYS), NOW, 1)).toBe(false);
  });

  it('deletes even a much-confirmed report past the ceiling', () => {
    expect(isExpired(daysBefore(MAX_RETENTION_DAYS), NOW, 99)).toBe(true);
  });
});

describe('daysUntilExpiry', () => {
  it('counts down from the base period', () => {
    expect(daysUntilExpiry(NOW, NOW)).toBe(BASE_RETENTION_DAYS);
  });

  it('counts down from the extended period when confirmed', () => {
    expect(daysUntilExpiry(NOW, NOW, 2)).toBe(
      BASE_RETENTION_DAYS + 2 * CONFIRMATION_EXTENSION_DAYS,
    );
  });

  it('never exceeds the ceiling', () => {
    expect(daysUntilExpiry(NOW, NOW, 99)).toBe(MAX_RETENTION_DAYS);
  });

  it('reaches zero on the day of deletion', () => {
    expect(daysUntilExpiry(daysBefore(BASE_RETENTION_DAYS), NOW)).toBe(0);
  });

  it('never goes negative for long-overdue reports', () => {
    expect(daysUntilExpiry(daysBefore(500), NOW)).toBe(0);
  });
});

describe('selectExpired', () => {
  it('returns only the reports the deletion job must remove', () => {
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

  it('spares a report that confirmations have kept alive', () => {
    const reports = [
      { id: 'unconfirmed', publishedAt: daysBefore(45) },
      { id: 'confirmed', publishedAt: daysBefore(45), confirmationCount: 1 },
    ];

    expect(selectExpired(reports, NOW).map((r) => r.id)).toEqual([
      'unconfirmed',
    ]);
  });

  it('still removes a confirmed report once the ceiling passes', () => {
    const reports = [
      { id: 'old', publishedAt: daysBefore(120), confirmationCount: 20 },
    ];

    expect(selectExpired(reports, NOW).map((r) => r.id)).toEqual(['old']);
  });

  it('handles an empty input', () => {
    expect(selectExpired([], NOW)).toEqual([]);
  });
});
