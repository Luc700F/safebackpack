/**
 * An in-memory report store.
 *
 * Backs the tests, and lets the whole submit-and-publish flow be clicked
 * through locally before a database exists. Data is lost on restart, which is
 * exactly what you want for a scratch environment.
 */

import { randomUUID } from 'node:crypto';

import type {
  NewReport,
  PublicationDetails,
  ReportRepository,
  StoredReport,
} from './repository';

export class MemoryReportRepository implements ReportRepository {
  private readonly reports = new Map<string, StoredReport>();

  async create(report: NewReport): Promise<StoredReport> {
    const stored: StoredReport = {
      ...report,
      id: randomUUID(),
      publicPosition: null,
      publishedAt: null,
      expiresAt: null,
      flagCount: 0,
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

  /** Test helper: every report, in insertion order. */
  all(): StoredReport[] {
    return [...this.reports.values()].map((report) => ({ ...report }));
  }

  clear(): void {
    this.reports.clear();
  }
}
