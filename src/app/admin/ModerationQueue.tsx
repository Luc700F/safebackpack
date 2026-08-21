'use client';

import { useCallback, useEffect, useState } from 'react';

import { resolveCategoryLabel, type ReportCategoryId } from '@/lib/reports/categories';
import { countryName } from '@/lib/geo/countries';
import { formatWhen } from '@/lib/format/relative-time';
import { timeOfDayLabel, type TimeOfDayId } from '@/lib/reports/time-of-day';

import styles from './page.module.css';

interface HeldReport {
  id: string;
  categoryId: ReportCategoryId;
  customCategoryLabel: string | null;
  description: string;
  timeOfDay: TimeOfDayId;
  countryCode: string;
  reporterFirstName: string | null;
  reporterHomeCountry: string;
  createdAt: string;
  reasons: string[];
}

type State =
  | { kind: 'checking' }
  | { kind: 'signed-out'; problem?: string }
  | { kind: 'loading' }
  | { kind: 'ready'; reports: HeldReport[] }
  | { kind: 'failed'; message: string };

/**
 * The moderation queue.
 *
 * One password, one person. Without this screen a held report is invisible to
 * everyone including the operator, which makes "hold" a quiet way of throwing
 * something away.
 */
export function ModerationQueue() {
  const [state, setState] = useState<State>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Fetching is kept apart from setting, so the effect below never writes
  // state until a request has actually come back.
  const fetchQueue = useCallback(async (): Promise<State> => {
    try {
      const response = await fetch('/api/v1/admin/reports');

      if (response.status === 401) return { kind: 'signed-out' };
      if (!response.ok) {
        return { kind: 'failed', message: 'The queue could not be loaded.' };
      }

      const body = await response.json();
      return { kind: 'ready', reports: body.data.reports as HeldReport[] };
    } catch {
      return { kind: 'failed', message: 'The server could not be reached.' };
    }
  }, []);

  const reload = useCallback(async () => {
    setState(await fetchQueue());
  }, [fetchQueue]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next = await fetchQueue();
      // The component may be gone by the time the answer arrives.
      if (!cancelled) setState(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchQueue]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy('sign-in');

    try {
      const response = await fetch('/api/v1/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = await response.json();
        setState({
          kind: 'signed-out',
          problem: body.error?.message ?? 'That did not work.',
        });
        return;
      }

      setPassword('');
      setState({ kind: 'loading' });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await fetch('/api/v1/admin/session', { method: 'DELETE' });
    setState({ kind: 'signed-out' });
  }

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);

    try {
      const response = await fetch(`/api/v1/admin/reports/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) await reload();
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === 'checking' || state.kind === 'loading') {
    return <p className={styles.empty}>Loading…</p>;
  }

  if (state.kind === 'failed') {
    return (
      <p className={styles.empty} role="alert">
        {state.message}
      </p>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <form className={styles.form} onSubmit={signIn}>
        <label htmlFor="password">Password</label>
        <input
          className={styles.input}
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <button className={styles.primary} type="submit" disabled={busy === 'sign-in'}>
          {busy === 'sign-in' ? 'Checking…' : 'Sign in'}
        </button>
        {state.problem && (
          <p className={styles.problem} role="alert">
            {state.problem}
          </p>
        )}
      </form>
    );
  }

  if (state.reports.length === 0) {
    return (
      <>
        <p className={styles.empty}>Nothing waiting. The queue is empty.</p>
        <button className={styles.signOut} type="button" onClick={signOut}>
          Sign out
        </button>
      </>
    );
  }

  return (
    <>
      <ul className={styles.queue}>
        {state.reports.map((report) => (
          <li className={styles.item} key={report.id}>
            <div className={styles.itemHeader}>
              <span className={styles.category}>
                {resolveCategoryLabel(report.categoryId, report.customCategoryLabel)}
              </span>
              <span className={styles.when}>{formatWhen(report.createdAt)}</span>
            </div>

            <div className={styles.reasons}>
              {report.reasons.map((reason) => (
                <span className={styles.reason} key={reason}>
                  {reason}
                </span>
              ))}
            </div>

            <p className={styles.description}>{report.description}</p>

            <div className={styles.meta}>
              <span>{countryName(report.countryCode)}</span>
              <span>{timeOfDayLabel(report.timeOfDay)}</span>
              <span>
                {report.reporterFirstName ?? 'Anonymous'} ·{' '}
                {countryName(report.reporterHomeCountry)}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.action}
                type="button"
                onClick={() => decide(report.id, 'approve')}
                disabled={busy === report.id}
              >
                Put on the map
              </button>
              <button
                className={styles.action}
                type="button"
                onClick={() => decide(report.id, 'reject')}
                disabled={busy === report.id}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className={styles.signOut} type="button" onClick={signOut}>
        Sign out
      </button>
    </>
  );
}
