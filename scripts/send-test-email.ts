/**
 * Sends one real verification email, to check that the Resend setup works.
 *
 *   npm run email:test -- you@example.com
 *
 * Until a domain is verified with Resend, the only address that will actually
 * receive anything is the one the Resend account was registered with.
 */

import { readFileSync } from 'node:fs';

import { ResendEmailSender } from '@/lib/email/resend';
import { buildVerificationEmail } from '@/lib/email/templates/verification';
import { EmailDeliveryError } from '@/lib/email/types';
import { TOKEN_TTL_MINUTES, createVerificationToken } from '@/lib/verification/token';

function loadEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};

  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return values;
  }

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim();
  }

  return values;
}

async function main(): Promise<void> {
  const recipient = process.argv[2];
  if (!recipient) {
    console.error('Usage: npm run email:test -- you@example.com');
    process.exit(1);
  }

  const env = { ...loadEnvFile('.env.local'), ...process.env };

  for (const variable of ['RESEND_API_KEY', 'EMAIL_FROM', 'NEXT_PUBLIC_SITE_URL']) {
    if (!env[variable]) {
      console.error(`Missing ${variable}. Fill it in in .env.local.`);
      process.exit(1);
    }
  }

  const { token } = createVerificationToken();
  const message = buildVerificationEmail({
    to: recipient,
    firstName: 'Luca',
    verificationUrl: `${env.NEXT_PUBLIC_SITE_URL}/verify?token=${token}`,
    expiryMinutes: TOKEN_TTL_MINUTES,
  });

  const sender = new ResendEmailSender({
    apiKey: env.RESEND_API_KEY!,
    from: env.EMAIL_FROM!,
  });

  try {
    await sender.send(message);
    console.log(`Sent to ${recipient} from ${env.EMAIL_FROM}.`);
    console.log('Check the inbox, and the spam folder.');
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      console.error(`Delivery failed: ${error.message}`);
      if (error.status === 403) {
        console.error(
          'Resend refuses addresses other than the one the account was ' +
            'registered with until a sending domain is verified.',
        );
      }
      process.exit(1);
    }

    throw error;
  }
}

main();
