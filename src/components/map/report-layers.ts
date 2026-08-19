/**
 * How reports are drawn on the map.
 *
 * Two representations of the same data, swapped by zoom. Far out, a heatmap
 * shows where reports cluster — individual pins would be meaningless mush.
 * Close in, single points, because at street level the question changes from
 * "where is busy" to "what happened here".
 *
 * Colours come from CSS custom properties so the map follows the design tokens
 * like everything else.
 */

import type { CircleLayerSpecification, HeatmapLayerSpecification } from 'maplibre-gl';

export const REPORTS_SOURCE = 'reports';
export const HEATMAP_LAYER = 'reports-heat';
export const POINTS_LAYER = 'reports-points';

/** Below this zoom the heatmap shows; above it, individual reports. */
export const POINT_ZOOM = 10;

function cssVariable(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

export function heatmapLayer(): HeatmapLayerSpecification {
  return {
    id: HEATMAP_LAYER,
    type: 'heatmap',
    source: REPORTS_SOURCE,
    maxzoom: POINT_ZOOM + 1,
    paint: {
      // A robbery weighs more than a scam; see categories.ts.
      'heatmap-weight': ['get', 'severity'],
      // Zoomed out, many reports overlap, so the ramp needs to saturate later.
      // Higher than the usual default: the ramp has to win against a map with
      // its own colours rather than against flat grey.
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1.6, 9, 4],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, cssVariable('--color-heat-0', 'rgba(255,214,10,0)'),
        0.15, cssVariable('--color-heat-1', '#ffd60a'),
        0.35, cssVariable('--color-heat-2', '#ffa62b'),
        0.55, cssVariable('--color-heat-3', '#ff6b35'),
        0.75, cssVariable('--color-heat-4', '#e5383b'),
        1, cssVariable('--color-heat-5', '#9d0208'),
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 9, 34],
      // Fade out as the individual points fade in, so neither jumps.
      'heatmap-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        POINT_ZOOM - 1, 0.95,
        POINT_ZOOM + 1, 0,
      ],
    },
  };
}

export function pointsLayer(): CircleLayerSpecification {
  return {
    id: POINTS_LAYER,
    type: 'circle',
    source: REPORTS_SOURCE,
    minzoom: POINT_ZOOM - 1,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 16, 10],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': cssVariable('--color-surface', '#ffffff'),
      'circle-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        POINT_ZOOM - 1, 0,
        POINT_ZOOM + 1, 1,
      ],
      'circle-stroke-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        POINT_ZOOM - 1, 0,
        POINT_ZOOM + 1, 1,
      ],
    },
  };
}
