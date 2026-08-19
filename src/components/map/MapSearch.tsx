'use client';

import { useEffect, useId, useState } from 'react';

import { searchCountries } from '@/lib/geo/country-search';
import { countryName } from '@/lib/geo/countries';
import { MIN_QUERY_LENGTH, type Place } from '@/lib/geo/places';

import styles from './MapSearch.module.css';

/** Where the map should go, and what the filter should become. */
export interface SearchChoice {
  countryCode: string | null;
  centre: { latitude: number; longitude: number; zoom: number } | null;
}

interface MapSearchProps {
  countryCode: string | null;
  onChoose: (choice: SearchChoice) => void;
  onClear: () => void;
}

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Finding somewhere on the map.
 *
 * Countries are matched against the list already in the browser, so choosing
 * one is instant and filters the map to it. Towns and streets go to the
 * geocoder and simply move the view — there is no useful "filter by street".
 */
export function MapSearch({ countryCode, onChoose, onClear }: MapSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);

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

  const searching = query.trim().length >= MIN_QUERY_LENGTH;
  const countries = searching ? searchCountries(query) : [];
  const suggestions = searching ? places : [];

  function choose(choice: SearchChoice, label: string) {
    setQuery(label);
    setPlaces([]);
    onChoose(choice);
  }

  return (
    <div className={styles.search}>
      <label className={styles.label} htmlFor={inputId}>
        Search a country or a place
      </label>

      <input
        className={styles.input}
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Thailand, Chiang Mai, Barcelona…"
        autoComplete="off"
      />

      {(countries.length > 0 || suggestions.length > 0) && (
        <ul className={styles.results} aria-label="Search results">
          {countries.map((country) => (
            <li key={`country-${country.code}`}>
              <button
                className={styles.result}
                type="button"
                onClick={() =>
                  choose(
                    { countryCode: country.code, centre: null },
                    country.name,
                  )
                }
              >
                {country.name}
                <span className={styles.kind}>Country</span>
              </button>
            </li>
          ))}

          {suggestions.map((place) => (
            <li key={`place-${place.id}`}>
              <button
                className={styles.result}
                type="button"
                onClick={() =>
                  choose(
                    {
                      countryCode: null,
                      centre: {
                        latitude: place.latitude,
                        longitude: place.longitude,
                        zoom: 11,
                      },
                    },
                    place.label,
                  )
                }
              >
                {place.label}
                <span className={styles.kind}>Place</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {countryCode && (
        <p className={styles.active}>
          Showing {countryName(countryCode)} only
          <button
            className={styles.clear}
            type="button"
            onClick={() => {
              setQuery('');
              onClear();
            }}
          >
            show the whole world
          </button>
        </p>
      )}
    </div>
  );
}
