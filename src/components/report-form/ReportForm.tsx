'use client';

import { useState } from 'react';

import {
  EMPTY_DRAFT,
  type ReportDraft,
  type ReportStep,
  draftToSubmission,
  errorsForStep,
  isStepComplete,
  nextStep,
  previousStep,
  validateDraft,
} from '@/lib/reports/draft';
import type { SubmissionErrors } from '@/lib/reports/submission';

import { IncidentStep } from './IncidentStep';
import { LocationStep } from './LocationStep';
import styles from './ReportForm.module.css';
import { ReporterStep } from './ReporterStep';
import { ReviewStep } from './ReviewStep';
import { Stepper } from './Stepper';

type Outcome =
  | { kind: 'verification_sent' }
  | { kind: 'published' }
  | { kind: 'error'; message: string };

export function ReportForm() {
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<ReportStep>('incident');
  // Messages appear once a step has been attempted, not while it is being typed.
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<SubmissionErrors>({});
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const errors = showErrors
    ? { ...validateDraft(draft), ...serverErrors }
    : serverErrors;
  const stepErrors = errorsForStep(errors, step);

  function update(patch: Partial<ReportDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setServerErrors({});
  }

  function goForward() {
    if (!isStepComplete(draft, step)) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
    setStep(nextStep(step));
  }

  function goBack() {
    setShowErrors(false);
    setStep(previousStep(step));
  }

  async function submit() {
    setPending(true);
    setOutcome(null);

    try {
      const response = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draftToSubmission(draft)),
      });
      const body = await response.json();

      if (response.ok) {
        setOutcome({
          kind: body.data.verificationRequired ? 'verification_sent' : 'published',
        });
        return;
      }

      if (body.error?.fields) {
        setServerErrors(body.error.fields as SubmissionErrors);
        setShowErrors(true);
        setStep('incident');
      }

      setOutcome({
        kind: 'error',
        message: body.error?.message ?? 'Something went wrong. Please try again.',
      });
    } catch {
      setOutcome({
        kind: 'error',
        message: 'We could not reach the server. Please check your connection.',
      });
    } finally {
      setPending(false);
    }
  }

  if (outcome?.kind === 'verification_sent' || outcome?.kind === 'published') {
    return <SubmittedPanel outcome={outcome.kind} />;
  }

  return (
    <div className={styles.form}>
      <Stepper current={step} />

      {step === 'incident' && (
        <IncidentStep draft={draft} errors={stepErrors} onChange={update} />
      )}
      {step === 'location' && (
        <LocationStep draft={draft} errors={stepErrors} onChange={update} />
      )}
      {step === 'reporter' && (
        <ReporterStep draft={draft} errors={stepErrors} onChange={update} />
      )}
      {step === 'review' && <ReviewStep draft={draft} />}

      {outcome?.kind === 'error' && (
        <p className={styles.alert} role="alert">
          {outcome.message}
        </p>
      )}

      <div className={styles.actions}>
        {step !== 'incident' && (
          <button className={styles.secondary} type="button" onClick={goBack}>
            Back
          </button>
        )}

        <span className={styles.spacer} />

        {step === 'review' ? (
          <button
            className={styles.primary}
            type="button"
            onClick={submit}
            disabled={pending}
          >
            {pending ? 'Sending…' : 'Publish this report'}
          </button>
        ) : (
          <button className={styles.primary} type="button" onClick={goForward}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function SubmittedPanel({ outcome }: { outcome: 'verification_sent' | 'published' }) {
  return (
    <div className={styles.done}>
      <h2 className={styles.doneTitle}>
        {outcome === 'published' ? 'Your report is on the map' : 'Check your inbox'}
      </h2>
      <p className={styles.doneText}>
        {outcome === 'published'
          ? 'We recognised you from an earlier report, so this one is published straight away. Thank you for helping other travellers.'
          : 'We sent you a confirmation link. Open it and your report goes on the map. The link works for 30 minutes.'}
      </p>
    </div>
  );
}
