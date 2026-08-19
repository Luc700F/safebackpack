/**
 * Turns reports into the GeoJSON the map draws.
 *
 * Kept out of the map component so it can be tested without a browser, and so
 * the rule that only the displaced position is ever plotted lives next to the
 * other report rules.
 *
 * Colours are resolved by the caller, because they come from CSS custom
 * properties that only exist in a browser.
 */

import type { ReportCategoryId } from './categories';
import type { PublicReport } from './public-report';

export interface ReportFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    categoryId: ReportCategoryId;
    severity: number;
    color: string;
  };
}

export interface ReportFeatureCollection {
  type: 'FeatureCollection';
  features: ReportFeature[];
}

export type ColorResolver = (categoryId: ReportCategoryId) => string;

export function toFeatureCollection(
  reports: readonly PublicReport[],
  colorFor: ColorResolver,
): ReportFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: reports.map((report) => ({
      type: 'Feature',
      // GeoJSON is longitude first. Getting this the wrong way round puts
      // Bangkok in Somalia, which is why it has a test.
      geometry: {
        type: 'Point',
        coordinates: [report.longitude, report.latitude],
      },
      properties: {
        id: report.id,
        categoryId: report.categoryId,
        severity: report.severity,
        color: colorFor(report.categoryId),
      },
    })),
  };
}
