import { describe, expect, it } from 'vitest';

import {
  type AnonymisableReport,
  RETAINED_GRID_DEGREES,
  anonymise,
  toGridCell,
  toMonth,
} from './anonymisation';

function report(overrides: Partial<AnonymisableReport> = {}): AnonymisableReport {
  return {
    categoryId: 'theft',
    countryCode: 'TH',
    timeOfDayId: 'night',
    latitude: 13.7563,
    longitude: 100.5018,
    publishedAt: new Date('2026-03-14T09:00:00.000Z'),
    confirmationCount: 2,
    ...overrides,
  };
}

describe('toMonth', () => {
  it('formats as YYYY-MM in UTC', () => {
    expect(toMonth(new Date('2026-03-14T09:00:00.000Z'))).toBe('2026-03');
  });

  it('zero-pads single digit months', () => {
    expect(toMonth(new Date('2026-01-31T23:59:59.000Z'))).toBe('2026-01');
  });

  it('uses UTC, not the local timezone, at a month boundary', () => {
    expect(toMonth(new Date('2026-02-01T00:30:00.000Z'))).toBe('2026-02');
  });
});

describe('toGridCell', () => {
  it('snaps to the south-west corner of the cell', () => {
    expect(toGridCell(13.7563, 100.5018)).toEqual({
      cellLatitude: 13.7,
      cellLongitude: 100.5,
    });
  });

  it('snaps negative coordinates downwards, away from zero', () => {
    expect(toGridCell(-13.65, -70.12)).toEqual({
      cellLatitude: -13.7,
      cellLongitude: -70.2,
    });
  });

  it('normalises negative zero', () => {
    const cell = toGridCell(-0.05, -0.05);
    expect(Object.is(cell.cellLatitude, -0)).toBe(false);
  });

  it('keeps a value already on a cell boundary in that cell', () => {
    expect(toGridCell(13.7, 100.5)).toEqual({
      cellLatitude: 13.7,
      cellLongitude: 100.5,
    });
  });

  it('is coarse enough that a cell names a place, not an address', () => {
    // 0.1 degrees is roughly 11 km.
    expect(RETAINED_GRID_DEGREES).toBeGreaterThanOrEqual(0.1);
  });

  it('still tells one city from the next', () => {
    const bangkok = toGridCell(13.7563, 100.5018);
    const chiangMai = toGridCell(18.7883, 98.9853);
    expect(bangkok).not.toEqual(chiangMai);
  });
});

describe('anonymise', () => {
  it('keeps the facts a statistic is built from', () => {
    expect(anonymise(report())).toEqual({
      categoryId: 'theft',
      countryCode: 'TH',
      timeOfDayId: 'night',
      cellLatitude: 13.7,
      cellLongitude: 100.5,
      month: '2026-03',
      confirmationCount: 2,
    });
  });

  it('carries no field that could name a person', () => {
    const anonymised = anonymise(report()) as unknown as Record<string, unknown>;

    for (const field of [
      'description',
      'reporterFirstName',
      'reporterEmail',
      'reporterEmailHash',
      'latitude',
      'longitude',
      'publishedAt',
    ]) {
      expect(anonymised[field]).toBeUndefined();
    }
  });

  it('never reproduces the exact position it was given', () => {
    const source = report({ latitude: 13.75634, longitude: 100.50187 });
    const anonymised = anonymise(source);

    expect(anonymised.cellLatitude).not.toBe(source.latitude);
    expect(anonymised.cellLongitude).not.toBe(source.longitude);
  });

  it('coarsens the date to a month, losing the day', () => {
    const first = anonymise(report({ publishedAt: new Date('2026-03-01T00:00:00Z') }));
    const last = anonymise(report({ publishedAt: new Date('2026-03-31T23:59:59Z') }));

    expect(first.month).toBe(last.month);
  });

  it('keeps how many travellers confirmed it', () => {
    expect(anonymise(report({ confirmationCount: 7 })).confirmationCount).toBe(7);
  });

  it('produces the same result twice, so a rerun changes nothing', () => {
    expect(anonymise(report())).toEqual(anonymise(report()));
  });
});

describe('grid boundaries in floating point', () => {
  // 13.7 / 0.1 is 136.99999999999997, so a naive floor puts a point sitting
  // exactly on a boundary into the cell below it.
  it.each([
    [13.7, 13.7],
    [0.1, 0.1],
    [0.3, 0.3],
    [8.7, 8.7],
    [-13.7, -13.7],
    [100.5, 100.5],
  ])('keeps %p on its own boundary at %p', (value, expected) => {
    expect(toGridCell(value, value).cellLatitude).toBeCloseTo(expected, 10);
  });

  it('puts a point just below a boundary in the cell below', () => {
    expect(toGridCell(13.6999, 0).cellLatitude).toBeCloseTo(13.6, 10);
  });

  it('puts a point just above a boundary in the cell above', () => {
    expect(toGridCell(13.7001, 0).cellLatitude).toBeCloseTo(13.7, 10);
  });
});
