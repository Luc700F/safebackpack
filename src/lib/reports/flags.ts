/**
 * Readers raising a concern about a published report.
 *
 * Deliberately open to anyone, with no verified address. Confirmations are a
 * vouch and need identity behind them; a flag is only ever a request for a
 * person to look, and requiring an account to say "this names my employee"
 * would mean the people most affected by a report are the least able to
 * question it.
 *
 * That openness is why enough flags hide a report rather than delete it, and
 * why one machine counts once per report.
 */

export type FlagReason =
  | 'inaccurate'
  | 'identifies_someone'
  | 'abusive'
  | 'spam'
  | 'other';

export const FLAG_REASONS: readonly { id: FlagReason; label: string }[] = [
  { id: 'inaccurate', label: 'This is not what happened' },
  { id: 'identifies_someone', label: 'This identifies a person' },
  { id: 'abusive', label: 'This is abusive' },
  { id: 'spam', label: 'This is advertising or spam' },
  { id: 'other', label: 'Something else' },
];

const REASON_IDS = new Set<string>(FLAG_REASONS.map((reason) => reason.id));

export function isFlagReason(value: unknown): value is FlagReason {
  return typeof value === 'string' && REASON_IDS.has(value);
}

/**
 * How many readers must object before a report leaves the map on its own.
 *
 * Three, not one: a single flag is as likely to be a business that dislikes
 * being mentioned as it is to be a genuine problem, and hiding on one would
 * hand anybody a delete button for reports they find inconvenient.
 */
export const FLAGS_TO_HIDE = 3;

export function shouldHide(flagCount: number): boolean {
  return flagCount >= FLAGS_TO_HIDE;
}
