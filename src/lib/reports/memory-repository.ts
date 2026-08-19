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
import type {
  NewReport,
  PublishedReportQuery,
  PublicationDetails,
  ReportRepository,
  StoredReport,
} from './repository';

export class MemoryReportRepository implements ReportRepository {
  private readonly reports = new Map<string, StoredReport>();
  private readonly confirmations = new Map<string, Confirmation[]>();

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
          report.publishedAt.getTime() >= query.publishedSince.getTime() &&
          (categories.size === 0 || categories.has(report.categoryId)) &&
          (!query.countryCode || report.countryCode === query.countryCode),
      )
      .sort(
        (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      )
      .slice(0, query.limit)
      .map((report) => ({ ...report }));
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
  }
}
