'use client';

import dynamic from 'next/dynamic';

import { TextField } from '@/components/form/TextField';
import type { ReportDraft } from '@/lib/reports/draft';
import type { SubmissionErrors } from '@/lib/reports/submission';

import styles from './ReportForm.module.css';

// MapLibre needs a browser: it touches window as soon as it is constructed.
const LocationPicker = dynamic(
  () =>
    import('@/components/map/LocationPicker').then(
      (module) => module.LocationPicker,
    ),
  {
    ssr: false,
    loading: () => <p className={styles.mapSlot}>Loading map…</p>,
  },
);

interface StepProps {
  draft: ReportDraft;
  errors: SubmissionErrors;
  onChange: (patch: Partial<ReportDraft>) => void;
}

export function LocationStep({ draft, errors, onChange }: StepProps) {
  const positionError = errors.latitude ?? errors.longitude;

  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>Where did it happen</h2>
      <p className={styles.stepIntro}>
        Search for the place, tap the map, or use your current position. The
        published position is deliberately blurred by about 100 metres, so a
        report never points at one exact doorway.
      </p>

      <LocationPicker
        latitude={draft.latitude}
        longitude={draft.longitude}
        onChange={onChange}
      />

      {positionError && (
        <p className={styles.alert} role="alert">
          {positionError}
        </p>
      )}

      {/* For anyone who already has coordinates, or who cannot use a map. */}
      <details className={styles.manual}>
        <summary className={styles.manualSummary}>Enter coordinates instead</summary>
        <div className={styles.coordinates}>
          <TextField
            label="Latitude"
            value={draft.latitude}
            onChange={(latitude) => onChange({ latitude })}
            error={errors.latitude}
            inputMode="decimal"
            placeholder="13.75630"
          />
          <TextField
            label="Longitude"
            value={draft.longitude}
            onChange={(longitude) => onChange({ longitude })}
            error={errors.longitude}
            inputMode="decimal"
            placeholder="100.50180"
          />
        </div>
      </details>
    </div>
  );
}
