/**
 * The report form's working state, and which field belongs to which step.
 *
 * The form validates the whole draft with `validateSubmission` and then shows
 * only the messages belonging to the step in view. That way there is one set
 * of rules rather than a per-step copy that can drift from the real one.
 */

import { type SubmissionErrors, validateSubmission } from './submission';

export type ReportStep = 'incident' | 'location' | 'reporter' | 'review';

export const REPORT_STEPS: readonly ReportStep[] = [
  'incident',
  'location',
  'reporter',
  'review',
];

export const STEP_LABELS: Record<ReportStep, string> = {
  incident: 'What happened',
  location: 'Where',
  reporter: 'About you',
  review: 'Review',
};

const STEP_FIELDS: Record<ReportStep, readonly (keyof SubmissionErrors)[]> = {
  incident: ['categoryId', 'customCategoryLabel', 'description', 'timeOfDay'],
  location: ['latitude', 'longitude'],
  reporter: [
    'reporterFirstName',
    'homeCountry',
    'email',
    'publishAnonymously',
  ],
  review: [],
};

/** Everything the form collects, before it is known to be valid. */
export interface ReportDraft {
  categoryId: string;
  customCategoryLabel: string;
  description: string;
  timeOfDay: string;
  latitude: string;
  longitude: string;
  reporterFirstName: string;
  homeCountry: string;
  email: string;
  publishAnonymously: boolean;
}

export const EMPTY_DRAFT: ReportDraft = {
  categoryId: '',
  customCategoryLabel: '',
  description: '',
  timeOfDay: '',
  latitude: '',
  longitude: '',
  reporterFirstName: '',
  homeCountry: '',
  email: '',
  publishAnonymously: false,
};

/** Turns the form's strings into the shape the API expects. */
export function draftToSubmission(draft: ReportDraft): Record<string, unknown> {
  return {
    categoryId: draft.categoryId,
    // Sent only where it means something, so a leftover value from switching
    // category cannot travel with a different one.
    ...(draft.categoryId === 'other'
      ? { customCategoryLabel: draft.customCategoryLabel }
      : {}),
    description: draft.description,
    timeOfDay: draft.timeOfDay,
    latitude: toNumber(draft.latitude),
    longitude: toNumber(draft.longitude),
    reporterFirstName: draft.reporterFirstName,
    homeCountry: draft.homeCountry,
    email: draft.email,
    publishAnonymously: draft.publishAnonymously,
  };
}

/**
 * An empty box is not the number zero. Anything unparseable stays a string so
 * the validator rejects it rather than silently reading it as a coordinate.
 */
function toNumber(value: string): number | string {
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

export function validateDraft(draft: ReportDraft): SubmissionErrors {
  const result = validateSubmission(draftToSubmission(draft));
  return result.ok ? {} : result.errors;
}

/** The messages belonging to one step, so earlier steps stay quiet. */
export function errorsForStep(
  errors: SubmissionErrors,
  step: ReportStep,
): SubmissionErrors {
  const fields = STEP_FIELDS[step];
  const filtered: SubmissionErrors = {};

  for (const field of fields) {
    if (errors[field]) filtered[field] = errors[field];
  }

  return filtered;
}

/** Whether the step in view has been filled in well enough to move on. */
export function isStepComplete(draft: ReportDraft, step: ReportStep): boolean {
  return Object.keys(errorsForStep(validateDraft(draft), step)).length === 0;
}

export function nextStep(step: ReportStep): ReportStep {
  const index = REPORT_STEPS.indexOf(step);
  return REPORT_STEPS[Math.min(index + 1, REPORT_STEPS.length - 1)];
}

export function previousStep(step: ReportStep): ReportStep {
  const index = REPORT_STEPS.indexOf(step);
  return REPORT_STEPS[Math.max(index - 1, 0)];
}
