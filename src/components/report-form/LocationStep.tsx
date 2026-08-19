'use client';

import { useState } from 'react';

import { TextField } from '@/components/form/TextField';
import type { ReportDraft } from '@/lib/reports/draft';
import type { SubmissionErrors } from '@/lib/reports/submission';

import styles from './ReportForm.module.css';

interface StepProps {
  draft: ReportDraft;
  errors: SubmissionErrors;
  onChange: (patch: Partial<ReportDraft>) => void;
}

export function LocationStep({ draft, errors, onChange }: StepProps) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function useCurrentPosition() {
    if (!('geolocation' in navigator)) {
      setLocationError('This browser cannot determine your position.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: position.coords.latitude.toFixed(5),
          longitude: position.coords.longitude.toFixed(5),
        });
        setLocating(false);
      },
      () => {
        setLocationError(
          'We could not read your position. You can type the coordinates instead.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>Where did it happen</h2>
      <p className={styles.stepIntro}>
        The published position is deliberately blurred by about 100 metres, so a
        report never points at one exact doorway.
      </p>

      <div className={styles.mapSlot}>
        <p>Picking a spot on a map arrives with the map itself.</p>
      </div>

      <button
        className={styles.locateButton}
        type="button"
        onClick={useCurrentPosition}
        disabled={locating}
      >
        {locating ? 'Finding you…' : 'Use my current position'}
      </button>

      {locationError && (
        <p className={styles.alert} role="alert">
          {locationError}
        </p>
      )}

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
    </div>
  );
}
