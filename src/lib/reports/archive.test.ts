import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_GRID_DEGREES,
  type ArchivableReport,
  aggregateForArchive,
  toArchiveMonth,
  toGridCell,
} from './archive';

function report(overrides: Partial<ArchivableReport> = {}): ArchivableReport {
  return {
    categoryId: 'theft',
    countryCode: 'TH',
    latitude: 13.75,
    longitude: 100.5,
    publishedAt: new Date('2026-03-14T09:00:00.000Z'),
    ...overrides,
  };
}

describe('toArchiveMonth', () => {
  it('formats as YYYY-MM in UTC', () => {
    expect(toArchiveMonth(new Date('2026-03-14T09:00:00.000Z'))).toBe('2026-03');
  });

  it('zero-pads single digit months', () => {
    expect(toArchiveMonth(new Date('2026-01-31T23:59:59.000Z'))).toBe('2026-01');
  });

  it('uses UTC, not the local timezone, at a month boundary', () => {
    expect(toArchiveMonth(new Date('2026-02-01T00:30:00.000Z'))).toBe('2026-02');
  });
});

describe('toGridCell', () => {
  it('snaps to the south-west corner of the cell', () => {
    expect(toGridCell(13.75, 100.6)).toEqual({
      cellLatitude: 13.5,
      cellLongitude: 100.5,
    });
  });

  it('snaps negative coordinates downwards, away from zero', () => {
    expect(toGridCell(-13.6, -70.1)).toEqual({
      cellLatitude: -14,
      cellLongitude: -70.5,
    });
  });

  it('normalises negative zero', () => {
    const cell = toGridCell(-0.2, -0.1);
    expect(Object.is(cell.cellLatitude, -0)).toBe(false);
    expect(cell).toEqual({ cellLatitude: -0.5, cellLongitude: -0.5 });
  });

  it('keeps a value already on a cell boundary in that cell', () => {
    expect(toGridCell(13.5, 100)).toEqual({
      cellLatitude: 13.5,
      cellLongitude: 100,
    });
  });

  it('is coarse enough to hide a precise location', () => {
    expect(ARCHIVE_GRID_DEGREES).toBeGreaterThanOrEqual(0.1);
  });
});

describe('aggregateForArchive', () => {
  it('collapses nearby reports of the same month and category into one count', () => {
    const rows = aggregateForArchive([
      report({ latitude: 13.75, longitude: 100.5 }),
      report({ latitude: 13.79, longitude: 100.62 }),
    ]);

    expect(rows).toEqual([
      {
        month: '2026-03',
        countryCode: 'TH',
        categoryId: 'theft',
        cellLatitude: 13.5,
        cellLongitude: 100.5,
        count: 2,
      },
    ]);
  });

  it('keeps different categories apart', () => {
    const rows = aggregateForArchive([
      report({ categoryId: 'theft' }),
      report({ categoryId: 'scam' }),
    ]);

    expect(rows.map((row) => [row.categoryId, row.count])).toEqual([
      ['scam', 1],
      ['theft', 1],
    ]);
  });

  it('keeps different months apart', () => {
    const rows = aggregateForArchive([
      report({ publishedAt: new Date('2026-03-01T00:00:00.000Z') }),
      report({ publishedAt: new Date('2026-04-01T00:00:00.000Z') }),
    ]);

    expect(rows.map((row) => row.month)).toEqual(['2026-03', '2026-04']);
  });

  it('keeps distant locations apart', () => {
    const rows = aggregateForArchive([
      report({ latitude: 13.75, longitude: 100.5 }),
      report({ latitude: 18.79, longitude: 98.98 }),
    ]);

    expect(rows).toHaveLength(2);
  });

  it('carries no personal data into the aggregate', () => {
    const [row] = aggregateForArchive([report()]);
    expect(Object.keys(row).sort()).toEqual([
      'categoryId',
      'cellLatitude',
      'cellLongitude',
      'count',
      'countryCode',
      'month',
    ]);
  });

  it('never reproduces the exact coordinates it was given', () => {
    const source = report({ latitude: 13.7563, longitude: 100.5018 });
    const [row] = aggregateForArchive([source]);
    expect(row.cellLatitude).not.toBe(source.latitude);
    expect(row.cellLongitude).not.toBe(source.longitude);
  });

  it('returns rows in a stable, reproducible order', () => {
    const input = [
      report({ countryCode: 'VN', publishedAt: new Date('2026-04-02T00:00:00Z') }),
      report({ countryCode: 'TH', publishedAt: new Date('2026-03-02T00:00:00Z') }),
      report({ countryCode: 'KH', publishedAt: new Date('2026-03-02T00:00:00Z') }),
    ];

    expect(aggregateForArchive(input).map((row) => row.countryCode)).toEqual([
      'KH',
      'TH',
      'VN',
    ]);
    expect(aggregateForArchive(input)).toEqual(
      aggregateForArchive([...input].reverse()),
    );
  });

  it('handles an empty input', () => {
    expect(aggregateForArchive([])).toEqual([]);
  });
});
