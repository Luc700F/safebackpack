import { describe, expect, it } from 'vitest';

import {
  RETENTION_DAYS,
  daysUntilExpiry,
  expiresAt,
  isExpired,
  selectExpired,
} from './retention';

const NOW = new Date('2026-08-19T12:00:00.000Z');

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('RETENTION_DAYS', () => {
  it('is the agreed six months', () => {
    expect(RETENTION_DAYS).toBe(180);
  });
});

describe('expiresAt', () => {
  it('adds the retention period to the publication date', () => {
    expect(expiresAt(new Date('2026-01-01T00:00:00.000Z')).toISOString()).toBe(
      '2026-06-30T00:00:00.000Z',
    );
  });
});

describe('isExpired', () => {
  it('keeps a report published today', () => {
    expect(isExpired(NOW, NOW)).toBe(false);
  });

  it('keeps a report one day short of the limit', () => {
    expect(isExpired(daysBefore(RETENTION_DAYS - 1), NOW)).toBe(false);
  });

  it('deletes a report exactly on the limit', () => {
    expect(isExpired(daysBefore(RETENTION_DAYS), NOW)).toBe(true);
  });

  it('deletes a report well past the limit', () => {
    expect(isExpired(daysBefore(400), NOW)).toBe(true);
  });
});

describe('daysUntilExpiry', () => {
  it('counts down from the full retention period', () => {
    expect(daysUntilExpiry(NOW, NOW)).toBe(RETENTION_DAYS);
  });

  it('reaches zero on the day of deletion', () => {
    expect(daysUntilExpiry(daysBefore(RETENTION_DAYS), NOW)).toBe(0);
  });

  it('never goes negative for long-overdue reports', () => {
    expect(daysUntilExpiry(daysBefore(500), NOW)).toBe(0);
  });
});

describe('selectExpired', () => {
  it('returns only the reports the deletion job must remove', () => {
    const reports = [
      { id: 'fresh', publishedAt: daysBefore(1) },
      { id: 'borderline', publishedAt: daysBefore(RETENTION_DAYS - 1) },
      { id: 'due', publishedAt: daysBefore(RETENTION_DAYS) },
      { id: 'overdue', publishedAt: daysBefore(365) },
    ];

    expect(selectExpired(reports, NOW).map((r) => r.id)).toEqual([
      'due',
      'overdue',
    ]);
  });

  it('returns an empty list when nothing is due', () => {
    expect(selectExpired([{ id: 'a', publishedAt: NOW }], NOW)).toEqual([]);
  });

  it('handles an empty input', () => {
    expect(selectExpired([], NOW)).toEqual([]);
  });
});
