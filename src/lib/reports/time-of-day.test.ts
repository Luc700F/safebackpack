import { describe, expect, it } from 'vitest';

import {
  TIMES_OF_DAY,
  isTimeOfDayId,
  timeOfDayFromHour,
  timeOfDayLabel,
  timeOfDayOf,
} from './time-of-day';

describe('TIMES_OF_DAY', () => {
  it('offers the three agreed buckets', () => {
    expect(TIMES_OF_DAY.map((time) => time.id)).toEqual([
      'day',
      'evening',
      'night',
    ]);
  });

  it('covers all 24 hours without gaps or overlaps', () => {
    const covered = Array.from({ length: 24 }, (_, hour) =>
      timeOfDayFromHour(hour),
    );
    expect(covered).toHaveLength(24);
    expect(new Set(covered)).toEqual(new Set(['day', 'evening', 'night']));
  });
});

describe('timeOfDayFromHour', () => {
  it.each([
    [6, 'day'],
    [12, 'day'],
    [17, 'day'],
    [18, 'evening'],
    [20, 'evening'],
    [21, 'night'],
    [23, 'night'],
    [0, 'night'],
    [5, 'night'],
  ])('maps %i:00 to %s', (hour, expected) => {
    expect(timeOfDayFromHour(hour)).toBe(expected);
  });

  it('treats the night bucket as wrapping past midnight', () => {
    expect(timeOfDayFromHour(23)).toBe(timeOfDayFromHour(2));
  });

  it.each([[-1], [24], [6.5], [Number.NaN]])(
    'rejects %p rather than mislabelling a report',
    (hour) => {
      expect(() => timeOfDayFromHour(hour)).toThrowError(RangeError);
    },
  );
});

describe('timeOfDayOf', () => {
  it('uses the local hour of the given date', () => {
    const date = new Date(2026, 7, 19, 22, 30);
    expect(timeOfDayOf(date)).toBe('night');
  });

  it('classifies a midday date as daytime', () => {
    expect(timeOfDayOf(new Date(2026, 7, 19, 13, 0))).toBe('day');
  });
});

describe('isTimeOfDayId', () => {
  it('accepts a known id', () => {
    expect(isTimeOfDayId('evening')).toBe(true);
  });

  it.each([['dusk'], [''], [null], [undefined], [3]])(
    'rejects %p',
    (value) => {
      expect(isTimeOfDayId(value)).toBe(false);
    },
  );
});

describe('timeOfDayLabel', () => {
  it('spells out the hours so the reporter knows what they are picking', () => {
    expect(timeOfDayLabel('night')).toBe('Night (21:00–06:00)');
  });

  it('throws on an unknown id', () => {
    expect(() => timeOfDayLabel('dusk' as never)).toThrowError(
      /Unknown time of day/,
    );
  });
});
