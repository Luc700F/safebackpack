import { describe, expect, it } from 'vitest';

import { utcCalendarDate } from './incident-date';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  validateSubmission,
} from './submission';

// Overrides are intentionally untyped: these tests feed the validator the kind
// of malformed input a hand-crafted request would carry, not just typos.
function submission(overrides: Record<string, unknown> = {}): unknown {
  return {
    description:
      'Two men on a scooter grabbed my bag near the night market entrance and rode off towards the river.',
    categoryId: 'theft',
    latitude: 13.7563,
    longitude: 100.5018,
    occurredOn: utcCalendarDate(new Date()),
    timeOfDay: 'night',
    reporterFirstName: 'Luca',
    homeCountry: 'CH',
    email: 'traveller@example.com',
    publishAnonymously: false,
    ...overrides,
  };
}

const CLOCK = new Date('2026-08-21T12:00:00.000Z');

describe('the day it happened', () => {
  it('accepts today', () => {
    expect(
      validateSubmission(submission({ occurredOn: '2026-08-21' }), CLOCK).ok,
    ).toBe(true);
  });

  it('accepts a report filed a few days late', () => {
    expect(
      validateSubmission(submission({ occurredOn: '2026-08-14' }), CLOCK).ok,
    ).toBe(true);
  });

  it('refuses a day older than the map will ever show', () => {
    const result = validateSubmission(
      submission({ occurredOn: '2026-01-01' }),
      CLOCK,
    );

    expect(result.ok).toBe(false);
    expect(result.ok || result.errors.occurredOn).toBeTruthy();
  });

  it('refuses a day in the future', () => {
    expect(
      validateSubmission(submission({ occurredOn: '2026-09-01' }), CLOCK).ok,
    ).toBe(false);
  });

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a timestamp', '2026-08-21T10:00:00Z'],
    ['empty', ''],
    ['missing', undefined],
    ['a number', 20260821],
  ])('refuses %s', (_case, value) => {
    expect(
      validateSubmission(submission({ occurredOn: value }), CLOCK).ok,
    ).toBe(false);
  });
});

describe('validateSubmission', () => {
  it('accepts a well-formed report', () => {
    const result = validateSubmission(submission());
    expect(result.ok).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = validateSubmission(
      submission({ reporterFirstName: '  Luca  ' }),
    );
    expect(result.ok && result.value.reporterFirstName).toBe('Luca');
  });

  it('rejects input that is not an object at all', () => {
    for (const value of [null, undefined, 'report', 42, []]) {
      expect(validateSubmission(value).ok).toBe(false);
    }
  });
});

describe('description', () => {
  it('rejects a description that is too short to be useful', () => {
    const result = validateSubmission(submission({ description: 'Robbed.' }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.description).toBeDefined();
  });

  it('accepts a description exactly at the minimum length', () => {
    const result = validateSubmission(
      submission({ description: 'a'.repeat(DESCRIPTION_MIN_LENGTH) }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a description beyond the maximum length', () => {
    const result = validateSubmission(
      submission({ description: 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1) }),
    );
    expect(result.ok).toBe(false);
  });

  it('counts length after trimming, not before', () => {
    const padded = `   ${'a'.repeat(DESCRIPTION_MIN_LENGTH - 1)}   `;
    expect(validateSubmission(submission({ description: padded })).ok).toBe(
      false,
    );
  });
});

describe('category', () => {
  it('rejects an unknown category', () => {
    expect(validateSubmission(submission({ categoryId: 'arson' })).ok).toBe(
      false,
    );
  });

  it('requires a custom label when the category is "other"', () => {
    const result = validateSubmission(submission({ categoryId: 'other' }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.customCategoryLabel).toBeDefined();
  });

  it('accepts "other" together with a custom label', () => {
    const result = validateSubmission(
      submission({ categoryId: 'other', customCategoryLabel: 'Stray dogs' }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a custom label containing a link', () => {
    const result = validateSubmission(
      submission({
        categoryId: 'other',
        customCategoryLabel: 'visit http://spam.example',
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('location', () => {
  it.each([
    ['latitude', 91],
    ['latitude', -91],
    ['longitude', 181],
    ['longitude', -181],
  ])('rejects %s of %p', (field, value) => {
    expect(validateSubmission(submission({ [field]: value })).ok).toBe(false);
  });

  it('rejects coordinates sent as strings', () => {
    expect(validateSubmission(submission({ latitude: '13.75' })).ok).toBe(false);
  });

  it('accepts the extremes of the valid range', () => {
    expect(
      validateSubmission(submission({ latitude: 90, longitude: 180 })).ok,
    ).toBe(true);
  });
});

describe('reporter name', () => {
  it('accepts names with accents, hyphens and apostrophes', () => {
    for (const name of ['José', 'Anne-Marie', "O'Brien", 'Łukasz', '楊']) {
      expect(validateSubmission(submission({ reporterFirstName: name })).ok).toBe(
        true,
      );
    }
  });

  it('rejects a name carrying markup', () => {
    const result = validateSubmission(
      submission({ reporterFirstName: '<script>alert(1)</script>' }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a name that is really an advertisement', () => {
    expect(
      validateSubmission(
        submission({ reporterFirstName: 'Buy cheap tickets www.spam.com' }),
      ).ok,
    ).toBe(false);
  });

  it('rejects a name containing digits', () => {
    expect(
      validateSubmission(submission({ reporterFirstName: 'Luca123' })).ok,
    ).toBe(false);
  });

  it('accepts a single-character name, ordinary in CJK languages', () => {
    expect(validateSubmission(submission({ reporterFirstName: '楊' })).ok).toBe(
      true,
    );
  });

  it.each([[''], ['   '], ['-'], ["'"]])(
    'rejects %p, which is not a name',
    (name) => {
      expect(
        validateSubmission(submission({ reporterFirstName: name })).ok,
      ).toBe(false);
    },
  );

  it('rejects an absurdly long name', () => {
    expect(
      validateSubmission(submission({ reporterFirstName: 'a'.repeat(41) })).ok,
    ).toBe(false);
  });
});

describe('home country', () => {
  it('accepts a valid ISO code', () => {
    expect(validateSubmission(submission({ homeCountry: 'TH' })).ok).toBe(true);
  });

  it.each([['XX'], ['ch'], ['CHE'], ['Switzerland'], ['']])(
    'rejects %p',
    (code) => {
      expect(validateSubmission(submission({ homeCountry: code })).ok).toBe(
        false,
      );
    },
  );
});

describe('email', () => {
  it.each([
    ['not-an-email'],
    ['@example.com'],
    ['traveller@'],
    ['traveller example@test.com'],
    [''],
  ])('rejects %p', (email) => {
    expect(validateSubmission(submission({ email })).ok).toBe(false);
  });

  it('rejects an address long enough to be an attack', () => {
    const email = `${'a'.repeat(250)}@example.com`;
    expect(validateSubmission(submission({ email })).ok).toBe(false);
  });
});

describe('error reporting', () => {
  it('reports one message per offending field', () => {
    const result = validateSubmission(
      submission({
        description: 'short',
        reporterFirstName: '1',
        homeCountry: 'XX',
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'description',
      'homeCountry',
      'reporterFirstName',
    ]);
  });

  it('gives messages a traveller can act on', () => {
    const result = validateSubmission(submission({ homeCountry: 'XX' }));
    expect(!result.ok && result.errors.homeCountry).toMatch(/home country/i);
  });

  it('never leaks internal field paths into the message', () => {
    const result = validateSubmission(submission({ description: '' }));
    expect(!result.ok && result.errors.description).not.toMatch(/zod|schema/i);
  });
});
