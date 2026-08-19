'use client';

import {
  REPORT_STEPS,
  STEP_LABELS,
  type ReportStep,
} from '@/lib/reports/draft';

import styles from './Stepper.module.css';

/**
 * Where the reporter is in the form. An ordered list rather than decoration,
 * so it reads correctly when the styles are ignored.
 */
export function Stepper({ current }: { current: ReportStep }) {
  const currentIndex = REPORT_STEPS.indexOf(current);

  return (
    <ol className={styles.stepper} aria-label="Progress">
      {REPORT_STEPS.map((step, index) => {
        const isCurrent = step === current;
        const isDone = index < currentIndex;

        return (
          <li
            key={step}
            className={`${styles.item} ${isCurrent ? styles.itemCurrent : ''} ${
              isDone ? styles.itemDone : ''
            }`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden="true">
              {isDone ? '✓' : index + 1}
            </span>
            {STEP_LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
