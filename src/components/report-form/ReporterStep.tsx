'use client';

import { useMemo } from 'react';

import { CheckboxField } from '@/components/form/CheckboxField';
import { SelectField } from '@/components/form/SelectField';
import { TextField } from '@/components/form/TextField';
import { countryOptions } from '@/lib/geo/countries';
import type { ReportDraft } from '@/lib/reports/draft';
import type { SubmissionErrors } from '@/lib/reports/submission';

import styles from './ReportForm.module.css';

interface StepProps {
  draft: ReportDraft;
  errors: SubmissionErrors;
  onChange: (patch: Partial<ReportDraft>) => void;
}

export function ReporterStep({ draft, errors, onChange }: StepProps) {
  const countries = useMemo(
    () =>
      countryOptions().map((country) => ({
        value: country.code,
        label: country.name,
      })),
    [],
  );

  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>About you</h2>
      <p className={styles.stepIntro}>
        No account needed. We confirm your email address once, so the map does
        not fill up with made-up reports.
      </p>

      <TextField
        label="First name"
        value={draft.reporterFirstName}
        onChange={(reporterFirstName) => onChange({ reporterFirstName })}
        error={errors.reporterFirstName}
        hint="Shown with your report, unless you choose otherwise below."
        autoComplete="given-name"
      />

      <SelectField
        label="Home country"
        value={draft.homeCountry}
        onChange={(homeCountry) => onChange({ homeCountry })}
        error={errors.homeCountry}
        options={countries}
        placeholder="Choose a country"
        hint="Shown with your report. It helps readers judge how familiar you were with the place."
      />

      <TextField
        label="Email address"
        value={draft.email}
        onChange={(email) => onChange({ email })}
        error={errors.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        hint="Never shown to anyone. Deleted when your report leaves the map."
      />

      <CheckboxField
        label="Publish without my name"
        checked={draft.publishAnonymously}
        onChange={(publishAnonymously) => onChange({ publishAnonymously })}
        hint="Your home country is still shown. Choose this if being named could put you at risk."
      />
    </div>
  );
}
