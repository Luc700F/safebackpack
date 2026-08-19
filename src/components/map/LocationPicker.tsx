'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  AttributionControl,
  Map as MapLibreMap,
  type MapMouseEvent,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import type { Place } from '@/lib/geo/places';
import { MIN_QUERY_LENGTH } from '@/lib/geo/places';

import {
  BASEMAP_ATTRIBUTION,
  type BasemapTheme,
  basemapStyleFor,
} from './basemap';
import styles from './LocationPicker.module.css';

const WORKER_URL = '/vendor/maplibre-gl-worker.mjs';
/** Long enough that typing a word does not fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 350;

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  onChange: (position: { latitude: string; longitude: string }) => void;
}

/**
 * Picking the spot on a map.
 *
 * Three ways in, because none of them works everywhere: search for a place,
 * drop the pin by tapping the map, or let the browser offer the current
 * position. The pin can then be dragged, which is how somebody moves it from
 * "the market" to "the corner by the market".
 */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: LocationPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current || map.current) return;

    setWorkerUrl(WORKER_URL);

    const instance = new MapLibreMap({
      container: container.current,
      style: basemapStyleFor(currentTheme()),
      center: [10, 25],
      zoom: 1.2,
      attributionControl: false,
    });

    instance.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: BASEMAP_ATTRIBUTION,
      }),
    );
    instance.addControl(new NavigationControl({ showCompass: false }));

    instance.on('error', (event) => {
      console.error('SafeBackpack location picker:', event.error?.message ?? event);
    });

    instance.on('click', (event: MapMouseEvent) => {
      place(event.lngLat.lat, event.lngLat.lng);
    });

    map.current = instance;

    return () => {
      marker.current?.remove();
      marker.current = null;
      instance.remove();
      map.current = null;
    };
  }, []);

  // Reflect whatever the form holds, whichever way it got there.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || latitude === '' || longitude === '') {
      marker.current?.remove();
      marker.current = null;
      return;
    }

    if (marker.current) {
      marker.current.setLngLat([lon, lat]);
      return;
    }

    const element = document.createElement('div');
    element.className = styles.marker;

    const created = new Marker({ element, draggable: true })
      .setLngLat([lon, lat])
      .addTo(instance);

    created.on('dragend', () => {
      const position = created.getLngLat();
      onChangeRef.current({
        latitude: position.lat.toFixed(5),
        longitude: position.lng.toFixed(5),
      });
    });

    marker.current = created;
  }, [latitude, longitude]);

  // Search as the reporter types, but not on every keystroke.
  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/v1/places?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((body) => setPlaces(body.data.places as Place[]))
        .catch(() => {
          if (!controller.signal.aborted) setPlaces([]);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function place(lat: number, lon: number, zoom?: number) {
    onChangeRef.current({
      latitude: lat.toFixed(5),
      longitude: lon.toFixed(5),
    });

    map.current?.easeTo({
      center: [lon, lat],
      zoom: zoom ?? Math.max(map.current.getZoom(), 13),
      duration: 700,
    });
  }

  function choose(candidate: Place) {
    setQuery(candidate.label);
    setPlaces([]);
    place(candidate.latitude, candidate.longitude, 13);
  }

  function useCurrentPosition() {
    if (!('geolocation' in navigator)) {
      setProblem('This browser cannot determine your position.');
      return;
    }

    setLocating(true);
    setProblem(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        place(position.coords.latitude, position.coords.longitude, 15);
        setLocating(false);
      },
      () => {
        setProblem(
          'We could not read your position. Search for the place or tap the map instead.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const hasPosition = latitude !== '' && longitude !== '';
  // Derived rather than cleared in an effect: a query too short to search has
  // no suggestions by definition, and there is no state to keep in step.
  const suggestions =
    query.trim().length >= MIN_QUERY_LENGTH ? places : [];

  return (
    <div className={styles.picker}>
      <div className={styles.searchRow}>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a place"
          aria-label="Search for a place"
          autoComplete="off"
        />
        <button
          className={styles.locate}
          type="button"
          onClick={useCurrentPosition}
          disabled={locating}
        >
          {locating ? 'Finding…' : 'Use my position'}
        </button>

        {suggestions.length > 0 && (
          <ul className={styles.suggestions} aria-label="Search results">
            {suggestions.map((candidate) => (
              <li key={candidate.id}>
                <button
                  className={styles.suggestion}
                  type="button"
                  onClick={() => choose(candidate)}
                >
                  {candidate.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.mapWrapper}>
        <div className={styles.canvas} ref={container} />
        <p className={styles.crosshairHint}>
          {hasPosition ? 'Drag the pin to adjust' : 'Tap the map to drop a pin'}
        </p>
      </div>

      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      <div className={styles.chosen}>
        {hasPosition ? (
          <>
            <span className={styles.coordinates}>
              {latitude}, {longitude}
            </span>
            <span>Published blurred by about 100 m</span>
          </>
        ) : (
          <span>No position chosen yet</span>
        )}
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
