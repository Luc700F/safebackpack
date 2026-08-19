import { describe, expect, it } from 'vitest';

import {
  EMPTY_DRAFT,
  REPORT_STEPS,
  type ReportDraft,
  draftToSubmission,
  errorsForStep,
  isStepComplete,
  nextStep,
  previousStep,
  validateDraft,
} from './draft';

function complete(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    categoryId: 'theft',
    customCategoryLabel: '',
    description:
      'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river.',
    timeOfDay: 'night',
    latitude: '13.7563',
    longitude: '100.5018',
    reporterFirstName: 'Luca',
    homeCountry: 'CH',
    email: 'traveller@example.com',
    publishAnonymously: false,
    ...overrides,
  };
}

describe('draftToSubmission', () => {
  it('turns coordinate strings into numbers', () => {
    const submission = draftToSubmission(complete());
    expect(submission.latitude).toBe(13.7563);
    expect(submission.longitude).toBe(100.5018);
  });

  it('keeps an empty coordinate as a string, so it is rejected not read as zero', () => {
    const submission = draftToSubmission(complete({ latitude: '' }));
    expect(submission.latitude).toBe('');
  });

  it('keeps unparseable text as text', () => {
    expect(draftToSubmission(complete({ latitude: 'north' })).latitude).toBe(
      'north',
    );
  });

  it('omits the custom label for a standard category', () => {
    const submission = draftToSubmission(
      complete({ categoryId: 'theft', customCategoryLabel: 'leftover' }),
    );
    expect('customCategoryLabel' in submission).toBe(false);
  });

  it('sends the custom label for the free-text category', () => {
    const submission = draftToSubmission(
      complete({ categoryId: 'other', customCategoryLabel: 'Stray dogs' }),
    );
    expect(submission.customCategoryLabel).toBe('Stray dogs');
  });
});

describe('validateDraft', () => {
  it('finds nothing wrong with a complete draft', () => {
    expect(validateDraft(complete())).toEqual({});
  });

  it('reports every empty field of a blank draft', () => {
    const errors = validateDraft(EMPTY_DRAFT);
    expect(Object.keys(errors).length).toBeGreaterThan(4);
  });
});

describe('errorsForStep', () => {
  it('shows only the messages belonging to the step in view', () => {
    const errors = validateDraft(EMPTY_DRAFT);

    expect(Object.keys(errorsForStep(errors, 'incident')).sort()).toEqual([
      'categoryId',
      'description',
      'timeOfDay',
    ]);
    expect(Object.keys(errorsForStep(errors, 'location')).sort()).toEqual([
      'latitude',
      'longitude',
    ]);
  });

  it('keeps the review step quiet, since it shows the whole picture', () => {
    expect(errorsForStep(validateDraft(EMPTY_DRAFT), 'review')).toEqual({});
  });
});

describe('isStepComplete', () => {
  it('blocks an empty first step', () => {
    expect(isStepComplete(EMPTY_DRAFT, 'incident')).toBe(false);
  });

  it('lets a filled first step through even while later steps are empty', () => {
    const draft = {
      ...EMPTY_DRAFT,
      categoryId: 'theft',
      timeOfDay: 'night',
      description: complete().description,
    };

    expect(isStepComplete(draft, 'incident')).toBe(true);
    expect(isStepComplete(draft, 'location')).toBe(false);
  });

  it('requires a custom label before leaving the first step', () => {
    const draft = {
      ...complete(),
      categoryId: 'other',
      customCategoryLabel: '',
    };

    expect(isStepComplete(draft, 'incident')).toBe(false);
  });

  it('accepts a complete draft at every step', () => {
    for (const step of REPORT_STEPS) {
      expect(isStepComplete(complete(), step)).toBe(true);
    }
  });
});

describe('moving between steps', () => {
  it('walks forwards through the steps', () => {
    expect(nextStep('incident')).toBe('location');
    expect(nextStep('location')).toBe('reporter');
    expect(nextStep('reporter')).toBe('review');
  });

  it('stops at the last step', () => {
    expect(nextStep('review')).toBe('review');
  });

  it('walks backwards through the steps', () => {
    expect(previousStep('review')).toBe('reporter');
    expect(previousStep('location')).toBe('incident');
  });

  it('stops at the first step', () => {
    expect(previousStep('incident')).toBe('incident');
  });
});
