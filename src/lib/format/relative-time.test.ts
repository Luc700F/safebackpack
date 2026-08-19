import { describe, expect, it } from 'vitest';

import { formatWhen } from './relative-time';

const NOW = new Date('2026-08-19T12:00:00.000Z');

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('formatWhen', () => {
  it('says today for something from this morning', () => {
    expect(formatWhen(new Date('2026-08-19T06:00:00Z').toISOString(), NOW)).toBe(
      'Today',
    );
  });

  it('says yesterday rather than "1 days ago"', () => {
    expect(formatWhen(daysBefore(1), NOW)).toBe('Yesterday');
  });

  it('counts days while that is still useful', () => {
    expect(formatWhen(daysBefore(12), NOW)).toBe('12 days ago');
    expect(formatWhen(daysBefore(29), NOW)).toBe('29 days ago');
  });

  it('switches to a month once a day count stops meaning anything', () => {
    expect(formatWhen(daysBefore(47), NOW)).toBe('Jul 2026');
  });

  it('does not print a negative age for a clock skew', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(formatWhen(future, NOW)).toBe('Just now');
  });

  it('returns nothing for a value that is not a date', () => {
    expect(formatWhen('not a date', NOW)).toBe('');
  });
});
