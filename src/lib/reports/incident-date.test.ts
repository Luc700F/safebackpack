import { describe, expect, it } from 'vitest';

import {
  MAX_BACKDATE_DAYS,
  formatIncidentDate,
  incidentDateRange,
  isCalendarDate,
  isWithinIncidentRange,
  localCalendarDate,
  parseCalendarDate,
  utcCalendarDate,
} from './incident-date';
import { MAX_RETENTION_DAYS } from './retention';

/** Midday UTC, so a test never straddles a day boundary by accident. */
const NOW = new Date('2026-08-21T12:00:00Z');

describe('MAX_BACKDATE_DAYS', () => {
  it('is the retention ceiling, not a number of its own', () => {
    expect(MAX_BACKDATE_DAYS).toBe(MAX_RETENTION_DAYS);
  });
});

describe('parseCalendarDate', () => {
  it('reads a date as UTC midnight', () => {
    expect(parseCalendarDate('2026-08-19')?.toISOString()).toBe(
      '2026-08-19T00:00:00.000Z',
    );
  });

  it('accepts a leap day in a leap year', () => {
    expect(parseCalendarDate('2028-02-29')?.toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a leap day outside a leap year', '2026-02-29'],
    ['a thirteenth month', '2026-13-01'],
    ['a zeroth day', '2026-01-00'],
    ['a two-digit year, which Date silently reads as 19xx', '50-01-01'],
    ['a timestamp rather than a date', '2026-08-19T10:00:00Z'],
    ['an unpadded month', '2026-8-19'],
    ['the American order', '08/19/2026'],
    ['empty', ''],
    ['nonsense', 'yesterday'],
  ])('refuses %s', (_case, value) => {
    expect(parseCalendarDate(value)).toBeNull();
  });

  it.each([[null], [undefined], [42], [{}], [new Date()]])(
    'refuses the non-string %s',
    (value) => {
      expect(parseCalendarDate(value)).toBeNull();
    },
  );
});

describe('isCalendarDate', () => {
  it('accepts a real date', () => {
    expect(isCalendarDate('2026-08-19')).toBe(true);
  });

  it('refuses one that only looks real', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
  });
});

describe('localCalendarDate', () => {
  it('reads the date off the local clock', () => {
    const moment = new Date(2026, 7, 19, 23, 30);
    expect(localCalendarDate(moment)).toBe('2026-08-19');
  });

  it('pads month and day', () => {
    expect(localCalendarDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('utcCalendarDate', () => {
  it('reads the date off UTC', () => {
    expect(utcCalendarDate(new Date('2026-08-19T23:30:00Z'))).toBe('2026-08-19');
  });

  it('round-trips with parseCalendarDate', () => {
    const parsed = parseCalendarDate('2026-03-01');
    expect(utcCalendarDate(parsed!)).toBe('2026-03-01');
  });
});

describe('incidentDateRange', () => {
  it('reaches back exactly the retention ceiling', () => {
    expect(incidentDateRange(NOW).earliest).toBe('2026-05-23');
  });

  it('allows tomorrow, because a reporter east of us is already there', () => {
    expect(incidentDateRange(NOW).latest).toBe('2026-08-22');
  });
});

describe('isWithinIncidentRange', () => {
  it('accepts today', () => {
    expect(isWithinIncidentRange('2026-08-21', NOW)).toBe(true);
  });

  it('accepts a report filed a few days late', () => {
    expect(isWithinIncidentRange('2026-08-17', NOW)).toBe(true);
  });

  it('accepts the oldest day still in range', () => {
    expect(isWithinIncidentRange('2026-05-23', NOW)).toBe(true);
  });

  it('refuses the day before that', () => {
    expect(isWithinIncidentRange('2026-05-22', NOW)).toBe(false);
  });

  it("accepts today as Kiritimati sees it, a day ahead of UTC", () => {
    expect(isWithinIncidentRange('2026-08-22', NOW)).toBe(true);
  });

  it('refuses a date further in the future than any timezone explains', () => {
    expect(isWithinIncidentRange('2026-08-23', NOW)).toBe(false);
  });

  it('refuses a date that is not a date', () => {
    expect(isWithinIncidentRange('2026-02-30', NOW)).toBe(false);
  });

  it('refuses a non-string', () => {
    expect(isWithinIncidentRange(undefined, NOW)).toBe(false);
  });
});

describe('formatIncidentDate', () => {
  it('writes the day out in full', () => {
    expect(formatIncidentDate('2026-08-19')).toBe('August 19, 2026');
  });

  it('does not shift the day when the reader is behind UTC', () => {
    // Formatting in local time would render UTC midnight as the previous day
    // for every reader west of Greenwich.
    expect(formatIncidentDate('2026-01-01')).toBe('January 1, 2026');
  });

  it('gives back nothing for a value that is not a date', () => {
    expect(formatIncidentDate('2026-02-30')).toBe('');
  });
});
