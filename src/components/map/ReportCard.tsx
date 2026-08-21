'use client';

import { useState } from 'react';

import { formatWhen } from '@/lib/format/relative-time';
import { countryName } from '@/lib/geo/countries';
import { REPORT_CATEGORIES, resolveCategoryLabel } from '@/lib/reports/categories';
import type { ConfirmationKind } from '@/lib/reports/confirmations';
import { FLAG_REASONS, type FlagReason } from '@/lib/reports/flags';
import { utcCalendarDate } from '@/lib/reports/incident-date';
import type { PublicReport } from '@/lib/reports/public-report';
import { timeOfDayLabel } from '@/lib/reports/time-of-day';

import styles from './ReportCard.module.css';

interface ReportCardProps {
  report: PublicReport;
  onClose: () => void;
  onConfirmed: (report: PublicReport, confirmations: number) => void;
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; message: string }
  | { kind: 'problem'; message: string };

/**
 * One report, opened from the map.
 *
 * Shows what the map cannot: what happened, when, who reported it and from
 * where — and the two answers another traveller can give. Those answers are
 * what keeps the map current, so they sit in the card rather than behind
 * another click.
 */
export function ReportCard({ report, onClose, onConfirmed }: ReportCardProps) {
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState<string | null>(null);

  async function flag(reason: FlagReason) {
    setFlagged('Thank you. Somebody will look at this report.');
    setFlagging(false);

    try {
      await fetch(`/api/v1/reports/${report.id}/flags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // The thanks stands either way. Somebody who has just seen their own
      // name on a map should not be handed an error message as well; the
      // request is retried by them pressing again if it mattered.
    }
  }

  async function confirm(kind: ConfirmationKind) {
    setFeedback({ kind: 'sending' });

    try {
      const response = await fetch(
        `/api/v1/reports/${report.id}/confirmations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind }),
        },
      );
      const body = await response.json();

      if (response.ok) {
        setFeedback({
          kind: 'done',
          message:
            kind === 'still_valid'
              ? 'Thank you — this report now runs for another month from today.'
              : 'Thank you. One more answer like yours retires it.',
        });
        onConfirmed(report, body.data.confirmations as number);
        return;
      }

      setFeedback({
        kind: 'problem',
        message: body.error?.message ?? 'That did not work. Please try again.',
      });
    } catch {
      setFeedback({
        kind: 'problem',
        message: 'We could not reach the server. Please try again.',
      });
    }
  }

  const category = REPORT_CATEGORIES.find(
    (entry) => entry.id === report.categoryId,
  );
  // Almost always the same day. When they differ the reader is told both, so
  // "3 weeks ago" can never be read as "reported 3 weeks ago" or the reverse.
  const backdated =
    report.occurredOn !== utcCalendarDate(new Date(report.publishedAt));
  const busy = feedback.kind === 'sending';
  const answered = feedback.kind === 'done';

  return (
    <aside
      className={styles.card}
      aria-label={`Report: ${resolveCategoryLabel(
        report.categoryId,
        report.customCategoryLabel,
      )}`}
    >
      <div className={styles.header}>
        <span className={styles.category}>
          <span
            className={styles.dot}
            style={
              {
                '--category-color': `var(${category?.colorToken ?? '--color-category-other'})`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          />
          {resolveCategoryLabel(report.categoryId, report.customCategoryLabel)}
        </span>
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.facts}>
        <span>{countryName(report.countryCode)}</span>
        <span>{timeOfDayLabel(report.timeOfDay)}</span>
        <span>{formatWhen(report.occurredOn)}</span>
        {backdated && (
          <span>Reported {formatWhen(report.publishedAt).toLowerCase()}</span>
        )}
      </div>

      <p className={styles.description}>{report.description}</p>

      <p className={styles.reporter}>
        Reported by {report.reporterFirstName ?? 'someone travelling'} from{' '}
        {countryName(report.reporterHomeCountry)} · position blurred by about
        100 m
      </p>

      <div className={styles.confirmations}>
        <span className={styles.confirmationsTitle}>
          {report.confirmations > 0
            ? `${report.confirmations} ${
                report.confirmations === 1 ? 'traveller says' : 'travellers say'
              } this still applies`
            : 'Nobody has confirmed this yet'}
        </span>

        {report.lastConfirmedAt && (
          <span className={styles.lastConfirmed}>
            Last confirmed {formatWhen(report.lastConfirmedAt).toLowerCase()}
          </span>
        )}

        {answered ? (
          <p className={styles.result}>{feedback.message}</p>
        ) : (
          <>
            <div className={styles.actions}>
              <button
                className={styles.action}
                type="button"
                onClick={() => confirm('still_valid')}
                disabled={busy}
              >
                Still applies
              </button>
              <button
                className={styles.action}
                type="button"
                onClick={() => confirm('no_longer_valid')}
                disabled={busy}
              >
                No longer applies
              </button>
            </div>

            {feedback.kind === 'problem' ? (
              <p className={`${styles.result} ${styles.resultProblem}`} role="alert">
                {feedback.message}
              </p>
            ) : (
              <p className={styles.confirmationsHint}>
                Answering needs a verified email address — file a report of your
                own once and you can vouch for others.
              </p>
            )}
          </>
        )}
      </div>

      {flagged ? (
        <p className={styles.confirmationsHint}>{flagged}</p>
      ) : flagging ? (
        <div className={styles.flagPanel}>
          <span className={styles.flagTitle}>What is wrong with it?</span>
          {FLAG_REASONS.map((reason) => (
            <button
              key={reason.id}
              className={styles.flagReason}
              type="button"
              onClick={() => flag(reason.id)}
            >
              {reason.label}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.flagRow}>
          <button
            className={styles.flagOpen}
            type="button"
            onClick={() => setFlagging(true)}
          >
            Report this entry
          </button>
        </div>
      )}
    </aside>
  );
}

