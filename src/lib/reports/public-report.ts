/**
 * The shape of a report as it leaves the server.
 *
 * There is deliberately no field for the exact position. A report's true
 * coordinates stay in the database, and the only way to serialise a report is
 * through this type — so "we forgot to strip it" cannot happen, because there
 * is nowhere to put it.
 *
 * The reporter's email, its hash and the verification token have no field here
 * either, for the same reason.
 */

import { type ReportCategoryId, severityOf } from './categories';
import type { StoredReport } from './repository';
import type { TimeOfDayId } from './time-of-day';

export interface PublicReport {
  id: string;
  categoryId: ReportCategoryId;
  /** The reporter's own wording, for the free-text category. */
  customCategoryLabel: string | null;
  description: string;
  timeOfDay: TimeOfDayId;

  /** The displaced position. The exact one never leaves the database. */
  latitude: number;
  longitude: number;
  countryCode: string;

  /** Null when the reporter chose to publish without a name. */
  reporterFirstName: string | null;
  reporterHomeCountry: string;

  publishedAt: string;
  /** How many other travellers said it still applies. */
  confirmations: number;
  /**
   * When one of them last said so. The count alone does not tell a reader
   * whether a hazard was vouched for yesterday or two months ago.
   */
  lastConfirmedAt: string | null;
  /** Heatmap weight, from the category. */
  severity: number;
}

export class NotPublishedError extends Error {
  constructor(id: string) {
    super(`Report ${id} is not published and must not be serialised`);
    this.name = 'NotPublishedError';
  }
}

/**
 * Refuses anything that is not published: a draft, a report held for review or
 * an anonymised one must never reach a client through this path.
 */
export function toPublicReport(report: StoredReport): PublicReport {
  if (
    report.status !== 'published' ||
    !report.publicPosition ||
    !report.publishedAt ||
    report.description === null
  ) {
    throw new NotPublishedError(report.id);
  }

  return {
    id: report.id,
    categoryId: report.categoryId,
    customCategoryLabel: report.customCategoryLabel,
    description: report.description,
    timeOfDay: report.timeOfDay,
    latitude: report.publicPosition.latitude,
    longitude: report.publicPosition.longitude,
    countryCode: report.countryCode,
    reporterFirstName: report.publishAnonymously
      ? null
      : report.reporterFirstName,
    reporterHomeCountry: report.reporterHomeCountry,
    publishedAt: report.publishedAt.toISOString(),
    confirmations: report.confirmationCount,
    lastConfirmedAt: report.lastConfirmedAt?.toISOString() ?? null,
    severity: severityOf(report.categoryId),
  };
}
