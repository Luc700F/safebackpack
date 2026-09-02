/**
 * The email that tells the operator a report is waiting for them.
 *
 * A held report is invisible to everybody — the reporter, readers, and the
 * operator unless they happen to open the queue. Without this message "hold"
 * is a quiet way of throwing a stranger's account of being robbed away, which
 * is the one outcome the screening was designed never to have.
 *
 * It deliberately does not carry the report's text. The description is why the
 * queue exists; putting it in an inbox copies it somewhere with its own
 * retention, its own backups and its own reading list, for no gain — the
 * operator has to open the queue to decide anyway.
 */

import type { EmailMessage } from '../types';

export interface HeldReportEmailInput {
  to: string;
  /** What the screener objected to. Never the reporter's own words. */
  reasons: readonly string[];
  queueUrl: string;
}

export const HELD_REPORT_SUBJECT = 'A SafeBackpack report is waiting for review';

export function buildHeldReportEmail(input: HeldReportEmailInput): EmailMessage {
  assertSafeUrl(input.queueUrl);

  const reasons =
    input.reasons.length > 0
      ? input.reasons.map((reason) => `- ${reason}`)
      : ['- no reason recorded'];

  const text = [
    'A report was held for review and is not visible to anyone until you decide.',
    '',
    'What the screener objected to:',
    ...reasons,
    '',
    'Open the queue to read it and decide:',
    input.queueUrl,
    '',
    'The report itself is not in this email on purpose — it stays in one place.',
    '',
    'SafeBackpack',
  ].join('\n');

  const html = [
    '<p>A report was held for review and is not visible to anyone until you decide.</p>',
    '<p>What the screener objected to:</p>',
    `<ul>${input.reasons
      .map((reason) => `<li>${escapeHtml(reason)}</li>`)
      .join('')}</ul>`,
    `<p><a href="${escapeHtml(input.queueUrl)}">Open the review queue</a></p>`,
    '<p>The report itself is not in this email on purpose — it stays in one place.</p>',
    '<p>SafeBackpack</p>',
  ].join('');

  return {
    to: input.to,
    subject: HELD_REPORT_SUBJECT,
    text,
    html,
  };
}

/**
 * The queue address is built from configuration rather than user input, but a
 * link in an email is worth being certain about either way.
 */
function assertSafeUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a usable link for an email: ${url}`);
  }

  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error(`Refusing to email a plaintext link: ${url}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
