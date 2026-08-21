/**
 * Validation of everything a reporter fills in.
 *
 * This is the single gate between the outside world and the database. The API
 * route validates here too, never trusting that the browser already did — a
 * form is a suggestion, not a guarantee.
 *
 * Messages live in one map rather than inline, so they can be translated the
 * day the interface gains a second language.
 */

import { z } from 'zod';

import { isCountryCode } from '../geo/countries';
import { REPORT_CATEGORIES, type ReportCategoryId } from './categories';
import {
  MAX_BACKDATE_DAYS,
  isCalendarDate,
  isWithinIncidentRange,
} from './incident-date';
import { TIMES_OF_DAY } from './time-of-day';

export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const FIRST_NAME_MAX_LENGTH = 40;
export const CUSTOM_LABEL_MAX_LENGTH = 60;

const categoryIds = REPORT_CATEGORIES.map((category) => category.id) as [
  ReportCategoryId,
  ...ReportCategoryId[],
];
const timeOfDayIds = TIMES_OF_DAY.map((time) => time.id) as [
  string,
  ...string[],
];

/** A name is letters, spaces, hyphens and apostrophes — nothing else. */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}\s'’-]*$/u;

export const reportSubmissionSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(DESCRIPTION_MIN_LENGTH)
      .max(DESCRIPTION_MAX_LENGTH),
    categoryId: z.enum(categoryIds),
    customCategoryLabel: z
      .string()
      .trim()
      .min(3)
      .max(CUSTOM_LABEL_MAX_LENGTH)
      .regex(NAME_PATTERN)
      .optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    occurredOn: z.string().refine(isCalendarDate),
    timeOfDay: z.enum(timeOfDayIds),
    reporterFirstName: z
      .string()
      .trim()
      // One character, not two: single-character given names are ordinary in
      // Chinese, Japanese and Korean, and a minimum of two would lock out a
      // large share of travellers.
      .min(1)
      .max(FIRST_NAME_MAX_LENGTH)
      .regex(NAME_PATTERN),
    homeCountry: z.string().refine(isCountryCode),
    email: z.email().max(254),
    publishAnonymously: z.boolean(),
  })
  .refine(
    (value) =>
      value.categoryId !== 'other' || Boolean(value.customCategoryLabel),
    { path: ['customCategoryLabel'] },
  );

export type ReportSubmission = z.infer<typeof reportSubmissionSchema>;

const MESSAGES: Record<string, string> = {
  description: `Please describe what happened in ${DESCRIPTION_MIN_LENGTH} to ${DESCRIPTION_MAX_LENGTH} characters.`,
  categoryId: 'Please choose a category.',
  customCategoryLabel:
    'Please name this type of risk in a few words, letters only.',
  latitude: 'Please pick a valid location.',
  longitude: 'Please pick a valid location.',
  occurredOn: `Please give the day this happened — today, or up to ${MAX_BACKDATE_DAYS} days ago.`,
  timeOfDay: 'Please choose what time of day this happened.',
  reporterFirstName:
    'Please enter your first name — letters, spaces and hyphens only.',
  homeCountry: 'Please choose your home country.',
  email: 'Please enter an email address we can send a confirmation to.',
  publishAnonymously: 'Please say whether your name may be shown.',
};

export type SubmissionErrors = Partial<Record<keyof ReportSubmission, string>>;

export type ValidationResult =
  | { ok: true; value: ReportSubmission }
  | { ok: false; errors: SubmissionErrors };

/**
 * Validates raw input. Returns one message per offending field, keyed by field
 * name, so a form can show each error where it belongs.
 *
 * The clock is a parameter because one rule depends on it: how far back a
 * report may be dated. Passing it in keeps that rule testable at a fixed
 * moment instead of only on the day the test happens to run.
 */
export function validateSubmission(
  input: unknown,
  now: Date = new Date(),
): ValidationResult {
  const parsed = reportSubmissionSchema.safeParse(input);

  if (parsed.success) {
    // The schema can tell a real date from a broken one, but not a plausible
    // one from a date last year — that needs to know what day it is.
    if (!isWithinIncidentRange(parsed.data.occurredOn, now)) {
      return { ok: false, errors: { occurredOn: MESSAGES.occurredOn } };
    }

    return { ok: true, value: parsed.data };
  }

  const errors: SubmissionErrors = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field && field in MESSAGES && !(field in errors)) {
      errors[field as keyof ReportSubmission] = MESSAGES[field];
    }
  }

  return { ok: false, errors };
}
