/**
 * Where the application is assembled.
 *
 * Route handlers ask for a service here rather than constructing one, so there
 * is exactly one place that knows which implementation backs which interface.
 * Swapping the in-memory store for Postgres is a change to this file alone.
 *
 * The service is kept for the lifetime of the process, so the in-memory store
 * survives between requests during development.
 */

import { hasEmailConfig, readSigningConfig } from './config/env';
import { RecordingEmailSender } from './email/fake';
import { ResendEmailSender } from './email/resend';
import type { EmailSender } from './email/types';
import { StaticCountryLocator } from './geo/country-locator';
import { MemoryReportRepository } from './reports/memory-repository';
import { ReportService } from './reports/service';
import { MemoryRateLimitStore } from './security/rate-limit-store';
import { RateLimiter } from './security/rate-limiter';

let service: ReportService | null = null;
let recordingSender: RecordingEmailSender | null = null;
let repository: MemoryReportRepository | null = null;

export function getReportService(): ReportService {
  if (service) return service;

  const signing = readSigningConfig();
  repository = new MemoryReportRepository();

  service = new ReportService({
    repository,
    emailSender: buildEmailSender(),
    // Until the database exists, every report is attributed to one country.
    // The real lookup is a PostGIS query; see docs/decisions.md.
    countryLocator: new StaticCountryLocator('TH'),
    rateLimiter: new RateLimiter(new MemoryRateLimitStore()),
    secret: signing.secret,
    siteUrl: signing.siteUrl,
  });

  warnAboutPlaceholders();

  return service;
}

function buildEmailSender(): EmailSender {
  if (!hasEmailConfig()) {
    recordingSender = new RecordingEmailSender();
    return recordingSender;
  }

  return new ResendEmailSender({
    apiKey: process.env.RESEND_API_KEY!,
    from: process.env.EMAIL_FROM!,
  });
}

/**
 * Development only: the messages a recording sender swallowed, so a
 * verification link can be followed without a mail account.
 */
export function getRecordedEmails(): RecordingEmailSender | null {
  return recordingSender;
}

export function getReportRepository(): MemoryReportRepository | null {
  return repository;
}

function warnAboutPlaceholders(): void {
  const placeholders = [
    'reports are stored in memory and lost on restart',
    'country lookup returns a fixed value',
  ];

  if (!hasEmailConfig()) {
    placeholders.push('email is recorded rather than sent');
  }

  console.warn(
    `safebackpack is running with placeholders: ${placeholders.join('; ')}.`,
  );
}
