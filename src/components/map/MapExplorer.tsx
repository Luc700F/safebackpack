'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AGE_WINDOWS, parseAgeWindow } from '@/lib/reports/age-window';
import {
  REPORT_CATEGORIES,
  isReportCategoryId,
  type ReportCategoryId,
} from '@/lib/reports/categories';
import type { PublicReport } from '@/lib/reports/public-report';

import styles from './MapExplorer.module.css';
import { MapSearch, type SearchChoice } from './MapSearch';
import { ReportCard } from './ReportCard';
import { ReportList } from './ReportList';

// MapLibre needs a browser: it touches window as soon as it is constructed.
const IncidentMap = dynamic(
  () => import('./IncidentMap').then((module) => module.IncidentMap),
  { ssr: false, loading: () => <p className={styles.empty}>Loading map…</p> },
);

/**
 * Filters, map and list, kept in step.
 *
 * The filter state lives in the URL rather than in component state, so a view
 * of the map is a link somebody can send: "scams in Thailand this month" is a
 * URL, not a sequence of clicks to repeat.
 */
export function MapExplorer() {
  const router = useRouter();
  const params = useSearchParams();

  const window = parseAgeWindow(params.get('window'));
  const categories = useMemo(
    () => parseCategories(params.get('categories')),
    [params],
  );
  const country = parseCountry(params.get('country'));

  const queryKey = `${window}|${categories.join(',')}|${country ?? ''}`;

  const [state, setState] = useState<QueryState>({
    key: queryKey,
    status: 'loading',
    reports: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [centre, setCentre] = useState<MapCentre | null>(null);

  // Reset while rendering when the filters change, rather than in an effect:
  // this is the "state derived from props" case React endorses, and it avoids
  // a frame that shows the previous filters' results as if they were current.
  if (state.key !== queryKey) {
    setState({ key: queryKey, status: 'loading', reports: [] });
  }

  useEffect(() => {
    const controller = new AbortController();

    const query = new URLSearchParams({ window });
    if (categories.length > 0) query.set('categories', categories.join(','));
    if (country) query.set('country', country);

    fetch(`/api/v1/reports?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) =>
        setState({
          key: queryKey,
          status: 'ready',
          reports: body.data.reports as PublicReport[],
        }),
      )
      .catch(() => {
        // An aborted request is a filter change, not a failure.
        if (!controller.signal.aborted) {
          setState({ key: queryKey, status: 'failed', reports: [] });
        }
      });

    return () => controller.abort();
  }, [window, categories, country, queryKey]);

  const { reports } = state;
  const loading = state.status === 'loading';
  const failed = state.status === 'failed';
  const selected = reports.find((entry) => entry.id === selectedId) ?? null;

  const updateParams = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      router.replace(query ? `/?${query}` : '/', { scroll: false });
    },
    [router],
  );

  function selectWindow(id: string) {
    const next = new URLSearchParams(params);
    next.set('window', id);
    updateParams(next);
  }

  function chooseFromSearch(choice: SearchChoice) {
    if (choice.countryCode) {
      const next = new URLSearchParams(params);
      next.set('country', choice.countryCode);
      updateParams(next);
      // Fitting the view to a whole country needs its outline, which the
      // browser does not have. Filtering is the useful half; the map follows
      // once reports for that country load.
      setCentre(null);
      return;
    }

    if (choice.centre) setCentre(choice.centre);
  }

  function clearCountry() {
    const next = new URLSearchParams(params);
    next.delete('country');
    updateParams(next);
  }

  function toggleCategory(id: ReportCategoryId) {
    const next = new URLSearchParams(params);
    const chosen = categories.includes(id)
      ? categories.filter((entry) => entry !== id)
      : [...categories, id];

    if (chosen.length === 0) next.delete('categories');
    else next.set('categories', chosen.join(','));

    updateParams(next);
  }

  const filtered = categories.length > 0;

  return (
    <div className={styles.explorer}>
      <div className={styles.filters}>
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>How recent</legend>
          <div className={styles.chips}>
            {AGE_WINDOWS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.chip} ${
                  option.id === window ? styles.chipActive : ''
                }`}
                aria-pressed={option.id === window}
                onClick={() => selectWindow(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>
            Type of incident
            {filtered ? '' : ' — showing everything'}
          </legend>
          <div className={styles.chips}>
            {REPORT_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`${styles.chip} ${
                  categories.includes(category.id) ? styles.chipActive : ''
                }`}
                aria-pressed={categories.includes(category.id)}
                onClick={() => toggleCategory(category.id)}
              >
                <span
                  className={styles.swatch}
                  style={
                    {
                      '--swatch-color': `var(${category.colorToken})`,
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                />
                {category.label}
              </button>
            ))}
          </div>
        </fieldset>

        {filtered && (
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('categories');
              updateParams(next);
            }}
          >
            Show every category
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.viewToggle} role="group" aria-label="View">
          {(['map', 'list'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.viewOption} ${
                view === option ? styles.viewOptionActive : ''
              }`}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === 'map' ? 'Map' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {view === 'map' ? (
      <IncidentMap
        reports={reports}
        loading={loading}
        onSelect={setSelectedId}
        focus={selected}
        centre={centre}
      >
        {selected && (
          <ReportCard
            report={selected}
            onClose={() => setSelectedId(null)}
            onConfirmed={(confirmed, confirmations) =>
              setState((current) => ({
                ...current,
                reports: current.reports.map((entry) =>
                  entry.id === confirmed.id ? { ...entry, confirmations } : entry,
                ),
              }))
            }
          />
        )}
      </IncidentMap>
      ) : (
        <ReportList
          reports={reports}
          selectedId={selectedId}
          loading={loading}
          onSelect={setSelectedId}
        />
      )}

      {failed && (
        <p className={styles.empty} role="alert">
          The reports could not be loaded. Please try again in a moment.
        </p>
      )}

      <div className={styles.below}>
        <MapSearch
          countryCode={country ?? null}
          onChoose={chooseFromSearch}
          onClear={clearCountry}
        />
      </div>
    </div>
  );
}

export interface MapCentre {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface QueryState {
  /** Which filter combination these reports belong to. */
  key: string;
  status: 'loading' | 'ready' | 'failed';
  reports: PublicReport[];
}

function parseCountry(value: string | null): string | undefined {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
}

function parseCategories(value: string | null): ReportCategoryId[] {
  if (!value) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is ReportCategoryId => isReportCategoryId(entry));
}
