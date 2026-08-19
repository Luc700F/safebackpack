'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import styles from './page.module.css';

type State =
  | { kind: 'ready' }
  | { kind: 'working' }
  | { kind: 'published' }
  | { kind: 'failed'; message: string };

/**
 * Confirms a report.
 *
 * The link in the email lands here, but publishing only happens when the
 * visitor presses the button: mail clients and security scanners open links in
 * messages before anyone reads them, and a report must never be published by a
 * machine following a link.
 */
export function VerifyPanel() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<State>({ kind: 'ready' });

  async function confirm() {
    setState({ kind: 'working' });

    try {
      const response = await fetch('/api/v1/reports/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json();

      setState(
        response.ok
          ? { kind: 'published' }
          : {
              kind: 'failed',
              message:
                body.error?.message ?? 'This link could not be confirmed.',
            },
      );
    } catch {
      setState({
        kind: 'failed',
        message: 'We could not reach the server. Please try again.',
      });
    }
  }

  if (!token) {
    return (
      <>
        <h1 className={styles.title}>Nothing to confirm</h1>
        <p className={styles.text}>
          This page needs the link from your confirmation email.
        </p>
        <Link className={styles.link} href="/">
          Back to the map
        </Link>
      </>
    );
  }

  if (state.kind === 'published') {
    return (
      <>
        <h1 className={styles.title}>Your report is on the map</h1>
        <p className={styles.text}>
          Thank you. It stays visible for a month, and longer each time another
          traveller confirms that it still applies.
        </p>
        <Link className={styles.link} href="/">
          See the map
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Confirm your report</h1>
      <p className={styles.text}>
        Press the button to publish the report you wrote. Nothing is visible to
        anyone until you do.
      </p>
      <button
        className={styles.button}
        type="button"
        onClick={confirm}
        disabled={state.kind === 'working'}
      >
        {state.kind === 'working' ? 'Publishing…' : 'Publish my report'}
      </button>
      {state.kind === 'failed' && (
        <p className={`${styles.text} ${styles.error}`} role="alert">
          {state.message}
        </p>
      )}
    </>
  );
}
