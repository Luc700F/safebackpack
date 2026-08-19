import { describe, expect, it } from 'vitest';

import {
  AGE_WINDOWS,
  DEFAULT_AGE_WINDOW,
  ageWindowStart,
  isAgeWindowId,
  isWithinAgeWindow,
  parseAgeWindow,
} from './age-window';
import { MAX_RETENTION_DAYS } from './retention';

const NOW = new Date('2026-08-19T12:00:00.000Z');

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('AGE_WINDOWS', () => {
  it('offers the five agreed windows in increasing order', () => {
    expect(AGE_WINDOWS.map((w) => w.id)).toEqual([
      '1d',
      '7d',
      '30d',
      '90d',
      '180d',
    ]);
    const days = AGE_WINDOWS.map((w) => w.days);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it('never reaches further back than a report can live', () => {
    for (const window of AGE_WINDOWS) {
      expect(window.days).toBeLessThanOrEqual(MAX_RETENTION_DAYS);
    }
  });

  it('has a default that is one of the offered windows', () => {
    expect(AGE_WINDOWS.some((w) => w.id === DEFAULT_AGE_WINDOW)).toBe(true);
  });
});

describe('parseAgeWindow', () => {
  it('keeps a valid id', () => {
    expect(parseAgeWindow('7d')).toBe('7d');
  });

  it.each([['1y'], [''], [null], [undefined], [7], [{}]])(
    'falls back to the default for %p instead of throwing',
    (value) => {
      expect(parseAgeWindow(value)).toBe(DEFAULT_AGE_WINDOW);
    },
  );
});

describe('isAgeWindowId', () => {
  it('separates known from unknown ids', () => {
    expect(isAgeWindowId('180d')).toBe(true);
    expect(isAgeWindowId('365d')).toBe(false);
  });
});

describe('ageWindowStart', () => {
  it('subtracts exactly the window length', () => {
    expect(ageWindowStart('7d', NOW).toISOString()).toBe(
      '2026-08-12T12:00:00.000Z',
    );
  });

  it('throws on an unknown window', () => {
    expect(() => ageWindowStart('99d' as never, NOW)).toThrowError(
      /Unknown age window/,
    );
  });
});

describe('isWithinAgeWindow', () => {
  it('includes a report published inside the window', () => {
    expect(isWithinAgeWindow(daysBefore(3), '7d', NOW)).toBe(true);
  });

  it('excludes a report older than the window', () => {
    expect(isWithinAgeWindow(daysBefore(8), '7d', NOW)).toBe(false);
  });

  it('includes a report sitting exactly on the boundary', () => {
    expect(isWithinAgeWindow(daysBefore(7), '7d', NOW)).toBe(true);
  });

  it('includes a report published this very second', () => {
    expect(isWithinAgeWindow(NOW, '1d', NOW)).toBe(true);
  });

  it('excludes a future timestamp', () => {
    const tomorrow = new Date(NOW.getTime() + 60_000);
    expect(isWithinAgeWindow(tomorrow, '180d', NOW)).toBe(false);
  });
});
