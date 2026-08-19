/**
 * The email that confirms a reporter's address.
 *
 * Deliberately plain: no images, no tracking pixel, no external stylesheet.
 * A verification mail that looks like marketing gets filtered as marketing.
 *
 * Every value that reaches the HTML is escaped, because a reporter's own name
 * ends up in this message and a name is attacker-controlled input.
 */

import type { EmailMessage } from '../types';

export interface VerificationEmailInput {
  to: string;
  /** Shown as a greeting. May be empty for an anonymous report. */
  firstName?: string;
  verificationUrl: string;
  expiryMinutes: number;
}

export const VERIFICATION_SUBJECT = 'Confirm your safebackpack report';

export function buildVerificationEmail(
  input: VerificationEmailInput,
): EmailMessage {
  assertSafeUrl(input.verificationUrl);

  const greeting = input.firstName?.trim()
    ? `Hi ${input.firstName.trim()}`
    : 'Hi';

  const text = [
    `${greeting},`,
    '',
    'Your report is ready to publish. Confirm your email address to put it on the map:',
    '',
    input.verificationUrl,
    '',
    `The link works for ${input.expiryMinutes} minutes and can be used once.`,
    '',
    'If you did not write a report on safebackpack, ignore this message — nothing will be published.',
    '',
    'safebackpack',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#fbfaf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#22201c;line-height:1.6">
  <div style="max-width:32rem;margin:0 auto">
    <p style="margin:0 0 16px">${escapeHtml(greeting)},</p>
    <p style="margin:0 0 24px">Your report is ready to publish. Confirm your email address to put it on the map.</p>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#1f8f80;color:#ffffff;text-decoration:none;font-weight:500">Confirm and publish</a>
    </p>
    <p style="margin:0 0 24px;color:#8d8779;font-size:14px">
      The link works for ${input.expiryMinutes} minutes and can be used once.
      If the button does not work, paste this into your browser:<br>
      <span style="word-break:break-all">${escapeHtml(input.verificationUrl)}</span>
    </p>
    <p style="margin:0;color:#8d8779;font-size:14px">
      If you did not write a report on safebackpack, ignore this message — nothing will be published.
    </p>
  </div>
</body>
</html>`;

  return { to: input.to, subject: VERIFICATION_SUBJECT, text, html };
}

/**
 * Refuses anything that is not a plain http(s) link, so a mistyped or injected
 * value cannot turn the confirm button into a `javascript:` or `data:` payload.
 */
function assertSafeUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Verification URL is not a valid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Refusing to send a ${url.protocol} link`);
  }
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}
