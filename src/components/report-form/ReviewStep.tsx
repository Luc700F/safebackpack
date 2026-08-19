'use client';

import { countryName } from '@/lib/geo/countries';
import { resolveCategoryLabel, type ReportCategoryId } from '@/lib/reports/categories';
import type { ReportDraft } from '@/lib/reports/draft';
import { timeOfDayLabel, type TimeOfDayId } from '@/lib/reports/time-of-day';

import styles from './ReportForm.module.css';

/**
 * The last look before anything is published. Shows exactly what other people
 * will see — including what will not be shown.
 */
export function ReviewStep({ draft }: { draft: ReportDraft }) {
  const rows: { term: string; value: string }[] = [
    {
      term: 'Type',
      value: resolveCategoryLabel(
        draft.categoryId as ReportCategoryId,
        draft.customCategoryLabel,
      ),
    },
    { term: 'Time of day', value: timeOfDayLabel(draft.timeOfDay as TimeOfDayId) },
    { term: 'What happened', value: draft.description },
    {
      term: 'Position',
      value: `${draft.latitude}, ${draft.longitude} — published blurred by about 100 m`,
    },
    {
      term: 'Shown as',
      value: draft.publishAnonymously
        ? `Anonymous, ${countryName(draft.homeCountry)}`
        : `${draft.reporterFirstName}, ${countryName(draft.homeCountry)}`,
    },
    {
      term: 'Your email',
      value: 'Never shown. Used once to confirm this report, then deleted.',
    },
  ];

  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>Review your report</h2>
      <p className={styles.stepIntro}>
        This is what other travellers will see. Nothing is published until you
        confirm your email address.
      </p>

      <dl className={styles.summary}>
        {rows.map((row) => (
          <div className={styles.summaryRow} key={row.term}>
            <dt className={styles.summaryTerm}>{row.term}</dt>
            <dd className={styles.summaryValue}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.notice}>
        Your report stays on the map for two months. Each time another
        traveller confirms it still applies, it runs for another month from
        that day — three months from publication at the very most. Two
        travellers saying it no longer applies retires it sooner. It then
        leaves the map and is stripped of everything personal: your name, your
        email address, the exact position and this description are deleted.
        What remains is an anonymous entry for statistics, with no link back to
        you.
      </p>
    </div>
  );
}
