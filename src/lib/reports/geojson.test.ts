import { describe, expect, it } from 'vitest';

import { toFeatureCollection } from './geojson';
import type { PublicReport } from './public-report';

function report(overrides: Partial<PublicReport> = {}): PublicReport {
  return {
    id: 'report-1',
    categoryId: 'theft',
    customCategoryLabel: null,
    description: 'Bag snatched near the market.',
    timeOfDay: 'night',
    latitude: 13.757,
    longitude: 100.502,
    countryCode: 'TH',
    reporterFirstName: 'Luca',
    reporterHomeCountry: 'CH',
    publishedAt: '2026-08-19T12:00:00.000Z',
    confirmations: 2,
    lastConfirmedAt: null,
    severity: 0.4,
    ...overrides,
  };
}

const colorFor = () => '#d97706';

describe('toFeatureCollection', () => {
  it('produces a feature collection', () => {
    const collection = toFeatureCollection([report()], colorFor);

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(1);
  });

  it('writes coordinates longitude first, as GeoJSON requires', () => {
    const [feature] = toFeatureCollection([report()], colorFor).features;

    expect(feature.geometry.coordinates).toEqual([100.502, 13.757]);
  });

  it('carries the severity the heatmap weighs by', () => {
    const [feature] = toFeatureCollection(
      [report({ severity: 1 })],
      colorFor,
    ).features;

    expect(feature.properties.severity).toBe(1);
  });

  it('carries a resolved colour, not a variable name', () => {
    const [feature] = toFeatureCollection([report()], colorFor).features;

    expect(feature.properties.color).toBe('#d97706');
  });

  it('asks the resolver for each report category', () => {
    const seen: string[] = [];
    toFeatureCollection(
      [report({ categoryId: 'theft' }), report({ categoryId: 'robbery' })],
      (categoryId) => {
        seen.push(categoryId);
        return '#000';
      },
    );

    expect(seen).toEqual(['theft', 'robbery']);
  });

  it('carries the id, so a click can find the report again', () => {
    const [feature] = toFeatureCollection(
      [report({ id: 'abc' })],
      colorFor,
    ).features;

    expect(feature.properties.id).toBe('abc');
  });

  it('carries nothing else — no description, no name', () => {
    const [feature] = toFeatureCollection([report()], colorFor).features;

    expect(Object.keys(feature.properties).sort()).toEqual([
      'categoryId',
      'color',
      'id',
      'severity',
    ]);
  });

  it('handles an empty list', () => {
    expect(toFeatureCollection([], colorFor)).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});
