'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  AttributionControl,
  GeolocateControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapLayerMouseEvent,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import { REPORT_CATEGORIES } from '@/lib/reports/categories';
import { toFeatureCollection } from '@/lib/reports/geojson';
import type { PublicReport } from '@/lib/reports/public-report';

import {
  BASEMAP_ATTRIBUTION,
  type BasemapTheme,
  basemapStyleFor,
} from './basemap';
import styles from './IncidentMap.module.css';
import {
  POINTS_LAYER,
  REPORTS_SOURCE,
  heatmapLayer,
  pointsLayer,
} from './report-layers';

/**
 * MapLibre's tile worker, copied into public/ by scripts/copy-maplibre-worker.ts.
 * Without this the worker request lands on the 404 page and the map renders its
 * controls over an empty canvas.
 */
const WORKER_URL = '/vendor/maplibre-gl-worker.mjs';

interface IncidentMapProps {
  reports: readonly PublicReport[];
  loading: boolean;
  onSelect: (id: string) => void;
}

/**
 * The world map with its heatmap of reports.
 *
 * Far out, density; close in, individual points. MapLibre owns the canvas, so
 * the map is created once and then fed new data — rebuilding it on every filter
 * change would throw away the visitor's position and zoom.
 */
export function IncidentMap({ reports, loading, onSelect }: IncidentMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  // Held in a ref so a new callback identity does not tear down the map.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || map.current) return;

    setWorkerUrl(WORKER_URL);

    const instance = new MapLibreMap({
      container: container.current,
      style: basemapStyleFor(currentTheme()),
      center: [10, 25],
      zoom: 1.4,
      attributionControl: false,
    });

    instance.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: BASEMAP_ATTRIBUTION,
      }),
    );
    instance.addControl(new NavigationControl({ showCompass: false }));
    instance.addControl(new GeolocateControl({ trackUserLocation: false }));

    instance.on('load', () => {
      instance.addSource(REPORTS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer(heatmapLayer());
      instance.addLayer(pointsLayer());
    });

    // MapLibre swallows tile and style failures unless something listens, so a
    // broken map looks like an empty one. Say so instead.
    instance.on('error', (event) => {
      console.error('safebackpack map:', event.error?.message ?? event);
    });

    instance.on('click', POINTS_LAYER, (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === 'string') onSelectRef.current(id);
    });

    for (const cursor of ['mouseenter', 'mouseleave'] as const) {
      instance.on(cursor, POINTS_LAYER, () => {
        instance.getCanvas().style.cursor =
          cursor === 'mouseenter' ? 'pointer' : '';
      });
    }

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  // Feed the existing map rather than rebuilding it, so panning and zooming
  // survive a filter change.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const apply = () => {
      const source = instance.getSource(REPORTS_SOURCE) as
        | GeoJSONSource
        | undefined;
      if (!source) return;

      source.setData(toFeatureCollection(reports, categoryColor));
    };

    if (instance.isStyleLoaded()) apply();
    else instance.once('idle', apply);
  }, [reports]);

  // Follow the interface theme: a light heat ramp on a dark map is unreadable.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = () => {
      const instance = map.current;
      if (!instance) return;

      instance.setStyle(basemapStyleFor(currentTheme()));
      instance.once('styledata', () => {
        if (instance.getSource(REPORTS_SOURCE)) return;

        instance.addSource(REPORTS_SOURCE, {
          type: 'geojson',
          data: toFeatureCollection(reports, categoryColor),
        });
        instance.addLayer(heatmapLayer());
        instance.addLayer(pointsLayer());
      });
    };

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [reports]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.canvas} ref={container} />
      <div className={styles.status}>
        <p className={styles.badge}>
          {loading
            ? 'Loading reports…'
            : reports.length === 0
              ? 'No reports match these filters'
              : `${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`}
        </p>
      </div>
    </div>
  );
}

function currentTheme(): BasemapTheme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark' || explicit === 'light') return explicit;

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * MapLibre paints with real colour values, not CSS variables, so each
 * category's token is resolved once here.
 */
function categoryColor(categoryId: string): string {
  const category = REPORT_CATEGORIES.find((entry) => entry.id === categoryId);
  if (!category) return '#6b7280';

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(category.colorToken)
    .trim();

  return value || '#6b7280';
}
