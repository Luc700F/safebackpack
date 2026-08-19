/**
 * The report store backed by Postgres and PostGIS.
 *
 * Holds no rules of its own: it reads and writes rows, and the constraints in
 * db/migrations guard what the service must never write. It is verified
 * against the same contract as the in-memory store, so the two cannot drift.
 *
 * The reporter's email is encrypted in the application before it reaches SQL,
 * so the plaintext never appears in a statement that a slow-query log or an
 * error tracker might capture.
 */

import type { Sql } from '../db/client';
import { open, seal } from '../crypto/secret-box';
import type {
  NewReport,
  PublishedReportQuery,
  PublicationDetails,
  ReportRepository,
  ReportStatus,
  StoredReport,
} from './repository';
import type { AnonymisedReport } from './anonymisation';
import type { Confirmation, ConfirmationKind } from './confirmations';
import type { ReportCategoryId } from './categories';
import type { TimeOfDayId } from './time-of-day';

interface ReportRow {
  id: string;
  status: ReportStatus;
  category: ReportCategoryId;
  custom_category_label: string | null;
  // Null once the row has been anonymised.
  description: string | null;
  time_of_day: TimeOfDayId;
  latitude: number | null;
  longitude: number | null;
  public_latitude: number | null;
  public_longitude: number | null;
  country_code: string;
  reporter_first_name: string | null;
  reporter_home_country: string;
  publish_anonymously: boolean;
  reporter_email_encrypted: Uint8Array | null;
  reporter_email_hash: string | null;
  verification_token_hash: string | null;
  verification_expires_at: Date | null;
  occurred_at: Date;
  created_at: Date;
  published_at: Date | null;
  expires_at: Date | null;
  flag_count: number;
  confirmation_count: number;
  retained_month: string | null;
  cell_latitude: string | null;
  cell_longitude: string | null;
  anonymised_at: Date | null;
}

export class PostgresReportRepository implements ReportRepository {
  private readonly sql: Sql;
  private readonly secret: string;

  constructor(sql: Sql, secret: string) {
    if (!secret) {
      throw new Error('Refusing to build a repository without a secret');
    }

    this.sql = sql;
    this.secret = secret;
  }

  async create(report: NewReport): Promise<StoredReport> {
    const { sql } = this;

    const [row] = await sql<ReportRow[]>`
      insert into reports (
        status, category, custom_category_label, description, time_of_day,
        position, country_code,
        reporter_first_name, reporter_home_country, publish_anonymously,
        reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at
      ) values (
        ${report.status}, ${report.categoryId}, ${report.customCategoryLabel},
        ${report.description}, ${report.timeOfDay},
        st_setsrid(st_makepoint(${report.position.longitude}, ${report.position.latitude}), 4326)::geography,
        ${report.countryCode},
        ${report.reporterFirstName}, ${report.reporterHomeCountry},
        ${report.publishAnonymously},
        ${seal(report.reporterEmail, this.secret)}, ${report.reporterEmailHash},
        ${report.verificationTokenHash}, ${report.verificationExpiresAt},
        ${report.occurredAt}, ${report.createdAt}
      )
      returning
        id, status, category, custom_category_label, description, time_of_day,
        st_y(position::geometry) as latitude,
        st_x(position::geometry) as longitude,
        st_y(public_position::geometry) as public_latitude,
        st_x(public_position::geometry) as public_longitude,
        country_code, reporter_first_name, reporter_home_country,
        publish_anonymously, reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at, published_at, expires_at,
        flag_count, confirmation_count,
        retained_month, cell_latitude, cell_longitude, anonymised_at
    `;

    return this.toReport(row);
  }

  async findById(id: string): Promise<StoredReport | null> {
    if (!isUuid(id)) return null;

    const [row] = await this.sql<ReportRow[]>`
      select
        id, status, category, custom_category_label, description, time_of_day,
        st_y(position::geometry) as latitude,
        st_x(position::geometry) as longitude,
        st_y(public_position::geometry) as public_latitude,
        st_x(public_position::geometry) as public_longitude,
        country_code, reporter_first_name, reporter_home_country,
        publish_anonymously, reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at, published_at, expires_at,
        flag_count, confirmation_count,
        retained_month, cell_latitude, cell_longitude, anonymised_at
      from reports where id = ${id}
    `;

    return row ? this.toReport(row) : null;
  }

  async findByVerificationTokenHash(
    hash: string,
  ): Promise<StoredReport | null> {
    const [row] = await this.sql<ReportRow[]>`
      select
        id, status, category, custom_category_label, description, time_of_day,
        st_y(position::geometry) as latitude,
        st_x(position::geometry) as longitude,
        st_y(public_position::geometry) as public_latitude,
        st_x(public_position::geometry) as public_longitude,
        country_code, reporter_first_name, reporter_home_country,
        publish_anonymously, reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at, published_at, expires_at,
        flag_count, confirmation_count,
        retained_month, cell_latitude, cell_longitude, anonymised_at
      from reports where verification_token_hash = ${hash}
    `;

    return row ? this.toReport(row) : null;
  }

  async publish(
    id: string,
    details: PublicationDetails,
  ): Promise<StoredReport> {
    if (!isUuid(id)) {
      throw new Error(`No such report: ${id}`);
    }

    const [row] = await this.sql<ReportRow[]>`
      update reports set
        status = 'published',
        public_position = st_setsrid(st_makepoint(
          ${details.publicPosition.longitude},
          ${details.publicPosition.latitude}
        ), 4326)::geography,
        published_at = ${details.publishedAt},
        expires_at = ${details.expiresAt},
        verification_token_hash = null,
        verification_expires_at = null
      where id = ${id}
      returning
        id, status, category, custom_category_label, description, time_of_day,
        st_y(position::geometry) as latitude,
        st_x(position::geometry) as longitude,
        st_y(public_position::geometry) as public_latitude,
        st_x(public_position::geometry) as public_longitude,
        country_code, reporter_first_name, reporter_home_country,
        publish_anonymously, reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at, published_at, expires_at,
        flag_count, confirmation_count,
        retained_month, cell_latitude, cell_longitude, anonymised_at
    `;

    if (!row) {
      throw new Error(`No such report: ${id}`);
    }

    return this.toReport(row);
  }

  async findPublished(query: PublishedReportQuery): Promise<StoredReport[]> {
    const { sql } = this;
    const categories = query.categories?.length ? query.categories : null;

    const rows = await sql<ReportRow[]>`
      select
        id, status, category, custom_category_label, description, time_of_day,
        st_y(position::geometry) as latitude,
        st_x(position::geometry) as longitude,
        st_y(public_position::geometry) as public_latitude,
        st_x(public_position::geometry) as public_longitude,
        country_code, reporter_first_name, reporter_home_country,
        publish_anonymously, reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at, published_at, expires_at,
        flag_count, confirmation_count,
        retained_month, cell_latitude, cell_longitude, anonymised_at
      from reports
      where status = 'published'
        and published_at >= ${query.publishedSince}
        ${categories ? sql`and category in ${sql(categories)}` : sql``}
        ${query.countryCode ? sql`and country_code = ${query.countryCode}` : sql``}
      order by published_at desc
      limit ${query.limit}
    `;

    return rows.map((row) => this.toReport(row));
  }

  async findConfirmations(reportId: string): Promise<Confirmation[]> {
    if (!isUuid(reportId)) return [];

    const rows = await this.sql<
      {
        report_id: string;
        kind: ConfirmationKind;
        confirmer_email_hash: string;
        created_at: Date;
      }[]
    >`
      select report_id, kind, confirmer_email_hash, created_at
      from report_confirmations
      where report_id = ${reportId}
      order by created_at
    `;

    return rows.map((row) => ({
      reportId: row.report_id,
      kind: row.kind,
      confirmerEmailHash: row.confirmer_email_hash,
      createdAt: row.created_at,
    }));
  }

  async addConfirmation(confirmation: Confirmation): Promise<void> {
    if (!isUuid(confirmation.reportId)) {
      throw new Error(`No such report: ${confirmation.reportId}`);
    }

    // The unique constraint and the self-confirmation trigger both live in the
    // database, so a race between two requests cannot produce a second vote.
    await this.sql`
      insert into report_confirmations (
        report_id, kind, confirmer_email_hash, created_at
      ) values (
        ${confirmation.reportId}, ${confirmation.kind},
        ${confirmation.confirmerEmailHash}, ${confirmation.createdAt}
      )
    `;
  }

  async applyConfirmationOutcome(
    reportId: string,
    outcome: {
      confirmationCount: number;
      retirementCount: number;
      expiresAt: Date;
      retired: boolean;
    },
  ): Promise<void> {
    if (!isUuid(reportId)) {
      throw new Error(`No such report: ${reportId}`);
    }

    const result = await this.sql`
      update reports set
        confirmation_count = ${outcome.confirmationCount},
        retirement_count = ${outcome.retirementCount},
        expires_at = ${outcome.expiresAt},
        status = ${outcome.retired ? 'retired' : 'published'}
      where id = ${reportId}
    `;

    if (result.count === 0) {
      throw new Error(`No such report: ${reportId}`);
    }
  }

  async findDueForAnonymisation(
    now: Date,
    limit: number,
  ): Promise<StoredReport[]> {
    const rows = await this.sql<ReportRow[]>`
      select
        id, status, category, custom_category_label, description, time_of_day,
        st_y(position::geometry) as latitude,
        st_x(position::geometry) as longitude,
        st_y(public_position::geometry) as public_latitude,
        st_x(public_position::geometry) as public_longitude,
        country_code, reporter_first_name, reporter_home_country,
        publish_anonymously, reporter_email_encrypted, reporter_email_hash,
        verification_token_hash, verification_expires_at,
        occurred_at, created_at, published_at, expires_at,
        flag_count, confirmation_count,
        retained_month, cell_latitude, cell_longitude, anonymised_at
      from reports
      where anonymised_at is null
        and expires_at is not null
        and expires_at <= ${now}
      order by expires_at
      limit ${limit}
    `;

    return rows.map((row) => this.toReport(row));
  }

  async anonymise(
    id: string,
    retained: AnonymisedReport,
    now: Date,
  ): Promise<void> {
    if (!isUuid(id)) {
      throw new Error(`No such report: ${id}`);
    }

    const result = await this.sql`
      update reports set
        status = 'archived',
        description = null,
        reporter_first_name = null,
        reporter_email_encrypted = null,
        reporter_email_hash = null,
        position = null,
        public_position = null,
        verification_token_hash = null,
        verification_expires_at = null,
        retained_month = ${retained.month},
        cell_latitude = ${retained.cellLatitude},
        cell_longitude = ${retained.cellLongitude},
        anonymised_at = ${now}
      where id = ${id}
    `;

    if (result.count === 0) {
      throw new Error(`No such report: ${id}`);
    }
  }

  /** Numeric columns come back as strings; only present once anonymised. */
  private toRetained(row: ReportRow): AnonymisedReport | null {
    if (
      row.retained_month === null ||
      row.cell_latitude === null ||
      row.cell_longitude === null
    ) {
      return null;
    }

    return {
      categoryId: row.category,
      countryCode: row.country_code.trim(),
      timeOfDayId: row.time_of_day,
      cellLatitude: Number(row.cell_latitude),
      cellLongitude: Number(row.cell_longitude),
      month: row.retained_month,
      confirmationCount: row.confirmation_count,
    };
  }

  private toReport(row: ReportRow): StoredReport {
    return {
      id: row.id,
      status: row.status,
      categoryId: row.category,
      customCategoryLabel: row.custom_category_label,
      description: row.description,
      timeOfDay: row.time_of_day,
      position:
        row.latitude === null || row.longitude === null
          ? null
          : { latitude: row.latitude, longitude: row.longitude },
      publicPosition:
        row.public_latitude === null || row.public_longitude === null
          ? null
          : { latitude: row.public_latitude, longitude: row.public_longitude },
      countryCode: row.country_code,
      reporterFirstName: row.reporter_first_name,
      reporterHomeCountry: row.reporter_home_country,
      publishAnonymously: row.publish_anonymously,
      reporterEmail: row.reporter_email_encrypted
        ? open(Buffer.from(row.reporter_email_encrypted), this.secret)
        : '',
      reporterEmailHash: row.reporter_email_hash,
      verificationTokenHash: row.verification_token_hash,
      verificationExpiresAt: row.verification_expires_at,
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
      flagCount: row.flag_count,
      confirmationCount: row.confirmation_count,
      retained: this.toRetained(row),
      anonymisedAt: row.anonymised_at,
    };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
