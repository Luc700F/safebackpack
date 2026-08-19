/**
 * Submitting and publishing a report.
 *
 * This is where the rules meet each other: validation, abuse limits, country
 * lookup, email verification, coordinate fuzzing and retention. The API routes
 * do nothing but hand input in and turn the outcome into a response, so the
 * whole flow is testable without a server.
 *
 * Everything the flow touches — storage, email, clock, randomness — arrives as
 * a dependency, so tests pin behaviour instead of waiting for it.
 */

import type { EmailSender } from '../email/types';
import { buildVerificationEmail } from '../email/templates/verification';
import type { CountryLocator } from '../geo/country-locator';
import { fuzzCoordinates } from '../geo/coordinates';
import {
  REPORTS_PER_EMAIL_PER_DAY,
  REPORTS_PER_IP_PER_DAY,
} from '../security/rate-limit';
import type { RateLimiter } from '../security/rate-limiter';
import { hashEmail } from '../verification/email-hash';
import {
  createRecognitionToken,
  readRecognitionToken,
} from '../verification/recognition';
import {
  TOKEN_TTL_MINUTES,
  createVerificationToken,
  hashToken,
  isTokenExpired,
} from '../verification/token';
import { expiresAt } from './retention';
import type { ReportRepository, StoredReport } from './repository';
import { type SubmissionErrors, validateSubmission } from './submission';

export interface ReportServiceDependencies {
  repository: ReportRepository;
  emailSender: EmailSender;
  countryLocator: CountryLocator;
  rateLimiter: RateLimiter;
  /** Signs recognition tokens and keys the email hash. */
  secret: string;
  siteUrl: string;
  clock?: () => Date;
  random?: () => number;
}

export interface SubmitContext {
  /** Hashed network address of the caller, for abuse limits. */
  ipHash: string;
  /** The recognition token the browser sent, if any. */
  recognitionToken?: string | null;
}

export type SubmitOutcome =
  | { status: 'invalid'; errors: SubmissionErrors }
  | { status: 'rate_limited'; retryAfterMs: number }
  | { status: 'location_unknown' }
  | { status: 'verification_sent'; reportId: string }
  | { status: 'published'; reportId: string; recognitionToken: string }
  | { status: 'email_failed' };

export type VerifyOutcome =
  | { status: 'published'; reportId: string; recognitionToken: string }
  | { status: 'invalid_token' }
  | { status: 'expired' };

export class ReportService {
  private readonly deps: ReportServiceDependencies;
  private readonly clock: () => Date;
  private readonly random: () => number;

  constructor(deps: ReportServiceDependencies) {
    this.deps = deps;
    this.clock = deps.clock ?? (() => new Date());
    this.random = deps.random ?? Math.random;
  }

  async submit(
    input: unknown,
    context: SubmitContext,
  ): Promise<SubmitOutcome> {
    const validation = validateSubmission(input);
    if (!validation.ok) {
      return { status: 'invalid', errors: validation.errors };
    }

    const submission = validation.value;
    const { rateLimiter, repository, countryLocator, secret } = this.deps;

    // Checked before the email limit, so probing many addresses from one
    // machine is capped even when each address is fresh.
    const byIp = await rateLimiter.check(
      `report:ip:${context.ipHash}`,
      REPORTS_PER_IP_PER_DAY,
    );
    if (!byIp.allowed) {
      return { status: 'rate_limited', retryAfterMs: byIp.retryAfterMs };
    }

    const emailHash = hashEmail(submission.email, secret);
    const byEmail = await rateLimiter.check(
      `report:email:${emailHash}`,
      REPORTS_PER_EMAIL_PER_DAY,
    );
    if (!byEmail.allowed) {
      return { status: 'rate_limited', retryAfterMs: byEmail.retryAfterMs };
    }

    const position = {
      latitude: submission.latitude,
      longitude: submission.longitude,
    };
    const countryCode = await countryLocator.locate(position);
    if (!countryCode) {
      return { status: 'location_unknown' };
    }

    const now = this.clock();
    const recognised = this.isRecognised(context.recognitionToken, emailHash);
    const verification = recognised ? null : createVerificationToken(now);

    const report = await repository.create({
      status: recognised ? 'screening' : 'pending_verification',
      categoryId: submission.categoryId,
      customCategoryLabel: submission.customCategoryLabel ?? null,
      description: submission.description,
      timeOfDay: submission.timeOfDay as StoredReport['timeOfDay'],
      position,
      countryCode,
      reporterFirstName: submission.publishAnonymously
        ? null
        : submission.reporterFirstName,
      reporterHomeCountry: submission.homeCountry,
      publishAnonymously: submission.publishAnonymously,
      reporterEmail: submission.email,
      reporterEmailHash: emailHash,
      verificationTokenHash: verification?.tokenHash ?? null,
      verificationExpiresAt: verification?.expiresAt ?? null,
      occurredAt: now,
      createdAt: now,
    });

    // A reporter who verified recently does not go back to their inbox.
    if (recognised) {
      await this.publish(report.id, now);
      return {
        status: 'published',
        reportId: report.id,
        recognitionToken: createRecognitionToken(emailHash, secret, now),
      };
    }

    try {
      await this.deps.emailSender.send(
        buildVerificationEmail({
          to: submission.email,
          firstName: submission.reporterFirstName,
          verificationUrl: this.verificationUrl(verification!.token),
          expiryMinutes: TOKEN_TTL_MINUTES,
        }),
      );
    } catch {
      // The draft stays behind, unverified, and the retention job clears it.
      // The caller is told to try again rather than left waiting for a mail
      // that will never arrive.
      return { status: 'email_failed' };
    }

    return { status: 'verification_sent', reportId: report.id };
  }

  async verify(token: unknown): Promise<VerifyOutcome> {
    if (typeof token !== 'string' || token.length === 0) {
      return { status: 'invalid_token' };
    }

    const report = await this.deps.repository.findByVerificationTokenHash(
      hashToken(token),
    );
    if (!report || !report.verificationExpiresAt) {
      return { status: 'invalid_token' };
    }

    const now = this.clock();
    if (isTokenExpired(report.verificationExpiresAt, now)) {
      return { status: 'expired' };
    }

    await this.publish(report.id, now);

    return {
      status: 'published',
      reportId: report.id,
      recognitionToken: createRecognitionToken(
        report.reporterEmailHash,
        this.deps.secret,
        now,
      ),
    };
  }

  private isRecognised(
    token: string | null | undefined,
    emailHash: string,
  ): boolean {
    const recognition = readRecognitionToken(
      token,
      this.deps.secret,
      this.clock(),
    );

    // The token must belong to the address being submitted, so a stale cookie
    // cannot verify somebody else's address.
    return recognition?.emailHash === emailHash;
  }

  private async publish(id: string, now: Date): Promise<void> {
    const report = await this.deps.repository.findById(id);
    if (!report) {
      throw new Error(`No such report: ${id}`);
    }

    await this.deps.repository.publish(id, {
      publicPosition: fuzzCoordinates(report.position, this.random),
      publishedAt: now,
      // A fresh report carries no confirmations yet; the confirmation flow
      // pushes this out later.
      expiresAt: expiresAt(now),
    });
  }

  private verificationUrl(token: string): string {
    const url = new URL('/verify', this.deps.siteUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
