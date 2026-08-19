/**
 * What a stored report looks like, and what the app needs to do with one.
 *
 * The service depends on this interface only. `memory-repository.ts` backs it
 * for tests and local development; a Postgres implementation follows once the
 * database exists.
 */

import type { Coordinates } from '../geo/coordinates';
import type { ReportCategoryId } from './categories';
import type { TimeOfDayId } from './time-of-day';

export type ReportStatus =
  | 'pending_verification'
  | 'screening'
  | 'published'
  | 'held_for_review'
  | 'rejected';

export interface StoredReport {
  id: string;
  status: ReportStatus;

  categoryId: ReportCategoryId;
  customCategoryLabel: string | null;
  description: string;
  timeOfDay: TimeOfDayId;

  /** The position the reporter picked. Never leaves the server. */
  position: Coordinates;
  /** Displaced position, written once on publication. This is what is served. */
  publicPosition: Coordinates | null;
  countryCode: string;

  reporterFirstName: string | null;
  reporterHomeCountry: string;
  publishAnonymously: boolean;

  reporterEmail: string;
  reporterEmailHash: string;

  verificationTokenHash: string | null;
  verificationExpiresAt: Date | null;

  occurredAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
  expiresAt: Date | null;

  flagCount: number;
}

export type NewReport = Omit<
  StoredReport,
  'id' | 'publicPosition' | 'publishedAt' | 'expiresAt' | 'flagCount'
>;

export interface PublicationDetails {
  publicPosition: Coordinates;
  publishedAt: Date;
  expiresAt: Date;
}

export interface ReportRepository {
  create(report: NewReport): Promise<StoredReport>;
  findById(id: string): Promise<StoredReport | null>;
  findByVerificationTokenHash(hash: string): Promise<StoredReport | null>;
  /** Marks a report published and clears its verification token. */
  publish(id: string, details: PublicationDetails): Promise<StoredReport>;
}
