/**
 * Other travellers vouching for a report — or retiring it.
 *
 * A hazard that people still see is a hazard that still exists, so a
 * confirmation extends a report's life (see `retention.ts`). The opposite
 * signal matters just as much: a cleared landslide or a finished demonstration
 * should leave the map without anyone having to moderate it.
 *
 * No account is involved. The confirmer is identified by the same keyed email
 * hash as a reporter, so the existing verification and recognition flow covers
 * this too.
 */

import type { ReportStatus } from './repository';

export type ConfirmationKind = 'still_valid' | 'no_longer_valid';

export interface Confirmation {
  reportId: string;
  /** Keyed hash of the confirmer's address. Never the address itself. */
  confirmerEmailHash: string;
  kind: ConfirmationKind;
  createdAt: Date;
}

/**
 * How many people must say a report no longer applies before it is retired.
 * More than one, so a single person cannot silence a report they dislike.
 */
export const CLOSURE_THRESHOLD = 2;

export type ConfirmationRefusal =
  | 'report_not_published'
  | 'own_report'
  | 'already_confirmed';

export type ConfirmationCheck =
  | { allowed: true }
  | { allowed: false; reason: ConfirmationRefusal };

export interface ConfirmableReport {
  status: ReportStatus;
  /** Null on an anonymised report, which is no longer confirmable anyway. */
  reporterEmailHash: string | null;
}

/**
 * Whether this person may add this confirmation.
 *
 * Vouching for your own report proves nothing, and one person counts once —
 * otherwise the extension in `retention.ts` becomes a way to keep a report
 * alive indefinitely on your own.
 */
export function canConfirm(
  report: ConfirmableReport,
  confirmerEmailHash: string,
  existing: readonly Confirmation[],
): ConfirmationCheck {
  if (report.status !== 'published') {
    return { allowed: false, reason: 'report_not_published' };
  }

  if (report.reporterEmailHash === confirmerEmailHash) {
    return { allowed: false, reason: 'own_report' };
  }

  const alreadyConfirmed = existing.some(
    (confirmation) => confirmation.confirmerEmailHash === confirmerEmailHash,
  );
  if (alreadyConfirmed) {
    return { allowed: false, reason: 'already_confirmed' };
  }

  return { allowed: true };
}

export interface ConfirmationSummary {
  stillValid: number;
  noLongerValid: number;
  /** True once enough people say the report has stopped applying. */
  shouldRetire: boolean;
}

export function summarise(
  confirmations: readonly Confirmation[],
): ConfirmationSummary {
  let stillValid = 0;
  let noLongerValid = 0;

  for (const confirmation of confirmations) {
    if (confirmation.kind === 'still_valid') stillValid += 1;
    else noLongerValid += 1;
  }

  return {
    stillValid,
    noLongerValid,
    shouldRetire: noLongerValid >= CLOSURE_THRESHOLD,
  };
}
