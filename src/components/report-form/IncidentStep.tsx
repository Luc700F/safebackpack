'use client';

import { ChoiceField } from '@/components/form/ChoiceField';
import { DateField } from '@/components/form/DateField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { TextField } from '@/components/form/TextField';
import { REPORT_CATEGORIES } from '@/lib/reports/categories';
import type { ReportDraft } from '@/lib/reports/draft';
import { incidentDateRange } from '@/lib/reports/incident-date';
import {
  CUSTOM_LABEL_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/lib/reports/submission';
import type { SubmissionErrors } from '@/lib/reports/submission';
import { TIMES_OF_DAY } from '@/lib/reports/time-of-day';

import styles from './ReportForm.module.css';

interface StepProps {
  draft: ReportDraft;
  errors: SubmissionErrors;
  onChange: (patch: Partial<ReportDraft>) => void;
}

export function IncidentStep({ draft, errors, onChange }: StepProps) {
  // Read once per render rather than per keystroke; the bounds only move at
  // midnight, and a form nobody has open for a day does not need to notice.
  const { earliest, latest } = incidentDateRange(new Date());

  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>What happened</h2>
      <p className={styles.stepIntro}>
        Describe it the way you would tell another traveller. Leave out names of
        people, and anything that would identify someone.
      </p>

      <ChoiceField
        legend="Type of incident"
        value={draft.categoryId}
        onChange={(categoryId) => onChange({ categoryId })}
        error={errors.categoryId}
        choices={REPORT_CATEGORIES.map((category) => ({
          value: category.id,
          label: category.label,
          hint: category.hint,
          colorToken: category.colorToken,
        }))}
      />

      {draft.categoryId === 'other' && (
        <TextField
          label="What would you call it?"
          value={draft.customCategoryLabel}
          onChange={(customCategoryLabel) => onChange({ customCategoryLabel })}
          error={errors.customCategoryLabel}
          hint={`A few words, letters only. Up to ${CUSTOM_LABEL_MAX_LENGTH} characters.`}
          placeholder="Aggressive stray dogs"
        />
      )}

      <DateField
        label="Day it happened"
        value={draft.occurredOn}
        onChange={(occurredOn) => onChange({ occurredOn })}
        error={errors.occurredOn}
        min={earliest}
        max={latest}
        hint="Today unless you say otherwise. Change it if you are reporting something from an earlier day."
      />

      <ChoiceField
        legend="Time of day"
        value={draft.timeOfDay}
        onChange={(timeOfDay) => onChange({ timeOfDay })}
        error={errors.timeOfDay}
        choices={TIMES_OF_DAY.map((time) => ({
          value: time.id,
          label: time.label,
        }))}
      />

      <TextAreaField
        label="What happened"
        value={draft.description}
        onChange={(description) => onChange({ description })}
        error={errors.description}
        maxLength={DESCRIPTION_MAX_LENGTH}
        hint="What happened, and what would have helped you avoid it."
        placeholder="Two men on a scooter grabbed my bag near the market entrance…"
      />
    </div>
  );
}
