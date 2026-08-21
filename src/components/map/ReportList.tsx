'use client';

import { formatWhen } from '@/lib/format/relative-time';
import { countryName } from '@/lib/geo/countries';
import { resolveCategoryLabel } from '@/lib/reports/categories';
import { REPORT_CATEGORIES } from '@/lib/reports/categories';
import type { PublicReport } from '@/lib/reports/public-report';
import { timeOfDayLabel } from '@/lib/reports/time-of-day';

import styles from './MapExplorer.module.css';

interface ReportListProps {
  reports: readonly PublicReport[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

/**
 * The same reports as a list.
 *
 * Not a fallback — a map is unusable with a screen reader or a keyboard, and
 * "what has been reported here lately" is often easier to read as a list
 * anyway. Both views show the same data from the same request.
 */
export function ReportList({
  reports,
  selectedId,
  loading,
  onSelect,
}: ReportListProps) {
  if (loading) {
    return <p className={styles.empty}>Loading reports…</p>;
  }

  if (reports.length === 0) {
    return (
      <p className={styles.empty}>
        No reports match these filters. Try a longer time span, or a different
        category.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {reports.map((report) => (
        <li
          key={report.id}
          id={`report-${report.id}`}
          className={`${styles.item} ${
            report.id === selectedId ? styles.itemSelected : ''
          }`}
          style={
            { '--item-color': `var(${colorToken(report)})` } as React.CSSProperties
          }
          aria-current={report.id === selectedId ? 'true' : undefined}
        >
          <button
            className={styles.itemOpen}
            type="button"
            onClick={() => onSelect(report.id)}
          >
            <span className={styles.itemHeader}>
              <span className={styles.itemCategory}>
                {resolveCategoryLabel(
                  report.categoryId,
                  report.customCategoryLabel,
                )}
              </span>
              <span className={styles.itemWhen}>
                {formatWhen(report.occurredOn)}
              </span>
            </span>

            <span className={styles.itemWhere}>
              {countryName(report.countryCode)}
            </span>

            <span className={styles.itemDescription}>{report.description}</span>
          </button>

          <div className={styles.itemFooter}>
            <span>{timeOfDayLabel(report.timeOfDay)}</span>
            <span>
              {report.reporterFirstName ?? 'Anonymous'} ·{' '}
              {countryName(report.reporterHomeCountry)}
            </span>
            {report.confirmations > 0 && (
              <span>
                Confirmed by {report.confirmations}{' '}
                {report.confirmations === 1 ? 'traveller' : 'travellers'}
                {report.lastConfirmedAt
                  ? `, last ${formatWhen(report.lastConfirmedAt).toLowerCase()}`
                  : ''}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function colorToken(report: PublicReport): string {
  return (
    REPORT_CATEGORIES.find((category) => category.id === report.categoryId)
      ?.colorToken ?? '--color-category-other'
  );
}

