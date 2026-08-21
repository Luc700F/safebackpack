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

import {
  hasDatabaseConfig,
  hasEmailConfig,
  hasRateLimitStoreConfig,
  readRateLimitStoreConfig,
  readSigningConfig,
} from './config/env';
import { getSql } from './db/client';
import { RecordingEmailSender } from './email/fake';
import { ResendEmailSender } from './email/resend';
import type { EmailSender } from './email/types';
import type { CountryLocator } from './geo/country-locator';
import { StaticCountryLocator } from './geo/country-locator';
import type { Geocoder } from './geo/photon-geocoder';
import { PhotonGeocoder } from './geo/photon-geocoder';
import { PostgisCountryLocator } from './geo/postgis-country-locator';
import { HeuristicScreener } from './moderation/screening';
import { MemoryReportRepository } from './reports/memory-repository';
import { PostgresReportRepository } from './reports/postgres-repository';
import type { ReportRepository } from './reports/repository';
import { ReportService } from './reports/service';
import type { RateLimitStore } from './security/rate-limit-store';
import { MemoryRateLimitStore } from './security/rate-limit-store';
import { RateLimiter } from './security/rate-limiter';
import { UpstashRateLimitStore } from './security/upstash-rate-limit-store';

let service: ReportService | null = null;
let geocoder: Geocoder | null = null;
let rateLimiter: RateLimiter | null = null;
let recordingSender: RecordingEmailSender | null = null;
let memoryRepository: MemoryReportRepository | null = null;
let jobRepository: ReportRepository | null = null;

export function getReportService(): ReportService {
  if (service) return service;

  const signing = readSigningConfig();

  service = new ReportService({
    repository: buildRepository(signing.secret),
    emailSender: buildEmailSender(),
    countryLocator: buildCountryLocator(),
    rateLimiter: getRateLimiter(),
    screener: new HeuristicScreener(),
    secret: signing.secret,
    siteUrl: signing.siteUrl,
  });

  warnAboutPlaceholders();

  return service;
}

/** Shared so every endpoint counts against the same buckets. */
export function getRateLimiter(): RateLimiter {
  rateLimiter ??= new RateLimiter(buildRateLimitStore());
  return rateLimiter;
}

function buildRateLimitStore(): RateLimitStore {
  if (!hasRateLimitStoreConfig()) {
    // Fine on one machine, useless on a platform that starts a fresh instance
    // per request: each one would begin counting from zero. The startup
    // warning names it for exactly that reason.
    return new MemoryRateLimitStore();
  }

  return new UpstashRateLimitStore(readRateLimitStoreConfig());
}

export function getGeocoder(): Geocoder {
  geocoder ??= new PhotonGeocoder();
  return geocoder;
}

function buildRepository(secret: string): ReportRepository {
  if (!hasDatabaseConfig()) {
    memoryRepository = new MemoryReportRepository();
    jobRepository = memoryRepository;
    return memoryRepository;
  }

  jobRepository = new PostgresReportRepository(getSql(), secret);
  return jobRepository;
}

function buildCountryLocator(): CountryLocator {
  if (!hasDatabaseConfig()) {
    // Without boundaries there is nothing to test a point against. One fixed
    // answer keeps the flow clickable locally; it is never right in production,
    // which is why the startup warning names it.
    return new StaticCountryLocator('TH');
  }

  return new PostgisCountryLocator(getSql());
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

/** Development only: the in-memory store, when no database is configured. */
export function getReportRepository(): MemoryReportRepository | null {
  return memoryRepository;
}

/**
 * The store the scheduled jobs work on. Building the service first means the
 * job and the app always share one repository rather than opening a second.
 */
export function getReportRepositoryForJobs(): ReportRepository {
  getReportService();
  return jobRepository!;
}

function warnAboutPlaceholders(): void {
  const placeholders: string[] = [];

  if (!hasDatabaseConfig()) {
    placeholders.push('reports are stored in memory and lost on restart');
    placeholders.push('country lookup returns a fixed value');
  }

  if (!hasEmailConfig()) {
    placeholders.push('email is recorded rather than sent');
  }

  if (!hasRateLimitStoreConfig()) {
    placeholders.push(
      'abuse limits are counted in memory, so they do not hold across instances',
    );
  }

  if (placeholders.length === 0) return;

  console.warn(
    `SafeBackpack is running with placeholders: ${placeholders.join('; ')}.`,
  );
}
