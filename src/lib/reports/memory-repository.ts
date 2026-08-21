/**
 * An in-memory report store.
 *
 * Backs the tests, and lets the whole submit-and-publish flow be clicked
 * through locally before a database exists. Data is lost on restart, which is
 * exactly what you want for a scratch environment.
 */

import { randomUUID } from 'node:crypto';

import type { AnonymisedReport } from './anonymisation';
import type { Confirmation } from './confirmations';
import type { FlagReason } from './flags';
import type {
  NewReport,
  PublishedReportQuery,
  PublicationDetails,
  ReportRepository,
  StoredReport,
} from './repository';
import { BASE_RETENTION_DAYS } from './retention';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class MemoryReportRepository implements ReportRepository {
  private readonly reports = new Map<string, StoredReport>();
  private readonly confirmations = new Map<string, Confirmation[]>();
  private readonly flags = new Map<string, Map<string, FlagReason>>();

  async create(report: NewReport): Promise<StoredReport> {
    const stored: StoredReport = {
      ...report,
      id: randomUUID(),
      publicPosition: null,
      publishedAt: null,
      expiresAt: null,
      flagCount: 0,
      confirmationCount: 0,
      lastConfirmedAt: null,
      retained: null,
      anonymisedAt: null,
    };

    this.reports.set(stored.id, stored);
    return { ...stored };
  }

  async findById(id: string): Promise<StoredReport | null> {
    const report = this.reports.get(id);
    return report ? { ...report } : null;
  }

  async findByVerificationTokenHash(
    hash: string,
  ): Promise<StoredReport | null> {
    for (const report of this.reports.values()) {
      if (report.verificationTokenHash === hash) {
        return { ...report };
      }
    }

    return null;
  }

  async publish(
    id: string,
    details: PublicationDetails,
  ): Promise<StoredReport> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`No such report: ${id}`);
    }

    const published: StoredReport = {
      ...report,
      status: 'published',
      publicPosition: details.publicPosition,
      publishedAt: details.publishedAt,
      expiresAt: details.expiresAt,
      // A used token must not work twice.
      verificationTokenHash: null,
      verificationExpiresAt: null,
    };

    this.reports.set(id, published);
    return { ...published };
  }

  async findPublished(query: PublishedReportQuery): Promise<StoredReport[]> {
    const categories = new Set(query.categories ?? []);

    return [...this.reports.values()]
      .filter(
        (report) =>
          report.status === 'published' &&
          report.publishedAt !== null &&
          report.occurredAt.getTime() >= query.occurredSince.getTime() &&
          (categories.size === 0 || categories.has(report.categoryId)) &&
          (!query.countryCode || report.countryCode === query.countryCode),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, query.limit)
      .map((report) => ({ ...report }));
  }

  async addFlag(input: {
    reportId: string;
    reason: FlagReason;
    reporterIpHash: string;
    createdAt: Date;
  }): Promise<number> {
    const report = this.reports.get(input.reportId);
    if (!report) {
      throw new Error(`No such report: ${input.reportId}`);
    }

    const existing = this.flags.get(input.reportId) ?? new Map();
    existing.set(input.reporterIpHash, input.reason);
    this.flags.set(input.reportId, existing);

    this.reports.set(input.reportId, { ...report, flagCount: existing.size });
    return existing.size;
  }

  async hideAfterFlags(reportId: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`No such report: ${reportId}`);
    }

    this.reports.set(reportId, { ...report, status: 'held_for_review' });
  }

  async holdForReview(id: string): Promise<void> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`No such report: ${id}`);
    }

    this.reports.set(id, {
      ...report,
      status: 'held_for_review',
      verificationTokenHash: null,
      verificationExpiresAt: null,
    });
  }

  async findHeldForReview(limit: number): Promise<StoredReport[]> {
    return [...this.reports.values()]
      .filter((report) => report.status === 'held_for_review')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map((report) => ({ ...report }));
  }

  async reject(id: string): Promise<void> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`No such report: ${id}`);
    }

    this.reports.set(id, { ...report, status: 'rejected' });
  }

  async findConfirmations(reportId: string): Promise<Confirmation[]> {
    return (this.confirmations.get(reportId) ?? []).map((entry) => ({
      ...entry,
    }));
  }

  async addConfirmation(confirmation: Confirmation): Promise<void> {
    const existing = this.confirmations.get(confirmation.reportId) ?? [];

    if (
      existing.some(
        (entry) => entry.confirmerEmailHash === confirmation.confirmerEmailHash,
      )
    ) {
      throw new Error('This person has already confirmed this report');
    }

    this.confirmations.set(confirmation.reportId, [
      ...existing,
      { ...confirmation },
    ]);
  }

  async applyConfirmationOutcome(
    reportId: string,
    outcome: {
      confirmationCount: number;
      retirementCount: number;
      lastConfirmedAt: Date | null;
      expiresAt: Date;
      retired: boolean;
    },
  ): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`No such report: ${reportId}`);
    }

    this.reports.set(reportId, {
      ...report,
      confirmationCount: outcome.confirmationCount,
      lastConfirmedAt: outcome.lastConfirmedAt,
      expiresAt: outcome.expiresAt,
      status: outcome.retired ? 'retired' : report.status,
    });
  }

  async findDueForAnonymisation(
    now: Date,
    limit: number,
  ): Promise<StoredReport[]> {
    return [...this.reports.values()]
      .filter(
        (report) =>
          report.anonymisedAt === null &&
          report.expiresAt !== null &&
          report.expiresAt.getTime() <= now.getTime(),
      )
      .slice(0, limit)
      .map((report) => ({ ...report }));
  }

  async anonymise(
    id: string,
    retained: AnonymisedReport,
    now: Date,
  ): Promise<void> {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`No such report: ${id}`);
    }

    this.reports.set(id, {
      ...report,
      status: 'archived',
      description: null,
      reporterFirstName: null,
      reporterEmail: null,
      reporterEmailHash: null,
      position: null,
      publicPosition: null,
      verificationTokenHash: null,
      verificationExpiresAt: null,
      retained,
      anonymisedAt: now,
    });
  }

  /**
   * Test helper: forces a stored report into a state the application would
   * never write, so error paths can be exercised.
   */
  corrupt(id: string, patch: Partial<StoredReport>): void {
    const report = this.reports.get(id);
    if (!report) {
      throw new Error(`No such report: ${id}`);
    }

    this.reports.set(id, { ...report, ...patch });
  }

  /** Test helper: every report, in insertion order. */
  all(): StoredReport[] {
    return [...this.reports.values()].map((report) => ({ ...report }));
  }

  clear(): void {
    this.reports.clear();
    this.confirmations.clear();
    this.flags.clear();
  }
  async findDueForDeletion(now: Date, limit: number): Promise<StoredReport[]> {
    return Array.from(this.reports.values())
      .filter((report) => neverPublished(report) && pastItsWindow(report, now))
      .slice(0, limit)
      .map((report) => ({ ...report }));
  }

  async deleteReport(id: string): Promise<void> {
    if (!this.reports.delete(id)) {
      throw new Error(`No such report: ${id}`);
    }

    this.confirmations.delete(id);
    this.flags.delete(id);
  }

}

/** Never on the map, and holding personal data that nothing else will clear. */
function neverPublished(report: StoredReport): boolean {
  return (
    report.publishedAt === null &&
    report.anonymisedAt === null &&
    (report.status === 'pending_verification' ||
      report.status === 'held_for_review' ||
      report.status === 'rejected')
  );
}

function pastItsWindow(report: StoredReport, now: Date): boolean {
  // A draft dies with its link: once that has lapsed nobody can confirm it.
  if (
    report.status === 'pending_verification' &&
    report.verificationExpiresAt !== null
  ) {
    return report.verificationExpiresAt.getTime() < now.getTime();
  }

  // Held and never reviewed, or rejected. Either has now had the same span a
  // published report would have been given.
  return (
    report.createdAt.getTime() + BASE_RETENTION_DAYS * MS_PER_DAY <
    now.getTime()
  );
}
