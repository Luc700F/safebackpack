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
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, cssVariable('--color-heat-0', 'rgba(255,237,160,0)'),
        0.2, cssVariable('--color-heat-1', '#ffeda0'),
        0.4, cssVariable('--color-heat-2', '#fed976'),
        0.6, cssVariable('--color-heat-3', '#feb24c'),
        0.8, cssVariable('--color-heat-4', '#fd8d3c'),
        1, cssVariable('--color-heat-5', '#f03b20'),
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 9, 30],
      // Fade out as the individual points fade in, so neither jumps.
      'heatmap-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        POINT_ZOOM - 1, 0.85,
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
