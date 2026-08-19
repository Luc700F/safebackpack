/**
 * Turns a service outcome into the JSON envelope a client sees.
 *
 * Separate from the route so it can be tested without a server, and so the
 * wording a traveller reads lives next to the rest of the report rules rather
 * than scattered through route handlers.
 */

import { type ApiResult, failure, success } from '../http/api-result';
import type { SubmitOutcome, VerifyOutcome } from './service';

export interface SubmitResponse {
  reportId: string;
  /** Whether the reporter still has to click a link in their inbox. */
  verificationRequired: boolean;
}

export interface VerifyResponse {
  reportId: string;
}

export function submitOutcomeToResult(
  outcome: SubmitOutcome,
): ApiResult<SubmitResponse> {
  switch (outcome.status) {
    case 'verification_sent':
      return success(
        { reportId: outcome.reportId, verificationRequired: true },
        201,
      );

    case 'published':
      return success(
        { reportId: outcome.reportId, verificationRequired: false },
        201,
      );

    case 'invalid':
      return failure('validation_failed', 'Please check the highlighted fields.', {
        fields: outcome.errors as Record<string, string>,
      });

    case 'rate_limited':
      return failure(
        'rate_limited',
        'You have filed several reports recently. Please try again later.',
        { retryAfterSeconds: Math.ceil(outcome.retryAfterMs / 1000) },
      );

    case 'location_unknown':
      return failure(
        'location_unknown',
        'That position does not fall inside any country. Please pick a place on land.',
      );

    case 'email_failed':
      return failure(
        'email_failed',
        'We could not send the confirmation email. Please try again in a moment.',
      );
  }
}

export function verifyOutcomeToResult(
  outcome: VerifyOutcome,
): ApiResult<VerifyResponse> {
  switch (outcome.status) {
    case 'published':
      return success({ reportId: outcome.reportId });

    case 'expired':
      return failure(
        'expired_token',
        'This confirmation link has expired. Please file the report again.',
      );

    case 'invalid_token':
      return failure(
        'invalid_token',
        'This confirmation link is not valid. It may already have been used.',
      );
  }
}
