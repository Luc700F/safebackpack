/**
 * What a stored report looks like, and what the app needs to do with one.
 *
 * The service depends on this interface only. `memory-repository.ts` backs it
 * for tests and local development; a Postgres implementation follows once the
 * database exists.
 */

import type { Coordinates } from '../geo/coordinates';
import type { AnonymisedReport } from './anonymisation';
import type { ReportCategoryId } from './categories';
import type { TimeOfDayId } from './time-of-day';

export type ReportStatus =
  | 'pending_verification'
  | 'screening'
  | 'published'
  | 'held_for_review'
  | 'rejected'
  /** Enough travellers said it no longer applies. */
  | 'retired'
  /** Past its time on the map, stripped of everything personal. */
  | 'archived';

export interface StoredReport {
  id: string;
  status: ReportStatus;

  categoryId: ReportCategoryId;
  customCategoryLabel: string | null;
  /** Cleared on anonymisation. */
  description: string | null;
  timeOfDay: TimeOfDayId;

  /** The position the reporter picked. Never leaves the server, cleared on anonymisation. */
  position: Coordinates | null;
  /** Displaced position, written once on publication. This is what is served. */
  publicPosition: Coordinates | null;
  countryCode: string;

  reporterFirstName: string | null;
  reporterHomeCountry: string;
  publishAnonymously: boolean;

  reporterEmail: string | null;
  reporterEmailHash: string | null;

  verificationTokenHash: string | null;
  verificationExpiresAt: Date | null;

  occurredAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
  expiresAt: Date | null;

  flagCount: number;
  /** Drives how long the report lives; see retention.ts. */
  confirmationCount: number;

  /** What survives anonymisation. Null while the report is still personal. */
  retained: AnonymisedReport | null;
  anonymisedAt: Date | null;
}

export type NewReport = Omit<
  StoredReport,
  | 'id'
  | 'publicPosition'
  | 'publishedAt'
  | 'expiresAt'
  | 'flagCount'
  | 'confirmationCount'
  | 'retained'
  | 'anonymisedAt'
> & {
  description: string;
  position: Coordinates;
  reporterEmail: string;
  reporterEmailHash: string;
};

export interface PublicationDetails {
  publicPosition: Coordinates;
  publishedAt: Date;
  expiresAt: Date;
}

/** What the map and the list view ask for. */
export interface PublishedReportQuery {
  /** Oldest publication timestamp to include. */
  publishedSince: Date;
  /** Empty or absent means every category. */
  categories?: readonly ReportCategoryId[];
  countryCode?: string;
  limit: number;
}

export interface ReportRepository {
  create(report: NewReport): Promise<StoredReport>;
  findById(id: string): Promise<StoredReport | null>;
  findByVerificationTokenHash(hash: string): Promise<StoredReport | null>;
  /** Marks a report published and clears its verification token. */
  publish(id: string, details: PublicationDetails): Promise<StoredReport>;

  /** Published reports matching the query, newest first. */
  findPublished(query: PublishedReportQuery): Promise<StoredReport[]>;

  /**
   * Reports whose time on the map is up and which still carry personal data.
   * Returned in batches so one very large backlog cannot exhaust memory.
   */
  findDueForAnonymisation(now: Date, limit: number): Promise<StoredReport[]>;

  /**
   * Replaces a report's personal fields with the retained summary. Deliberately
   * not a delete: see docs/decisions.md.
   */
  anonymise(
    id: string,
    retained: AnonymisedReport,
    now: Date,
  ): Promise<void>;
}
