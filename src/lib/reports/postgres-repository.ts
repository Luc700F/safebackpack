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
  PublicationDetails,
  ReportRepository,
  ReportStatus,
  StoredReport,
} from './repository';
import type { ReportCategoryId } from './categories';
import type { TimeOfDayId } from './time-of-day';

interface ReportRow {
  id: string;
  status: ReportStatus;
  category: ReportCategoryId;
  custom_category_label: string | null;
  description: string;
  time_of_day: TimeOfDayId;
  latitude: number;
  longitude: number;
  public_latitude: number | null;
  public_longitude: number | null;
  country_code: string;
  reporter_first_name: string | null;
  reporter_home_country: string;
  publish_anonymously: boolean;
  reporter_email_encrypted: Uint8Array | null;
  reporter_email_hash: string;
  verification_token_hash: string | null;
  verification_expires_at: Date | null;
  occurred_at: Date;
  created_at: Date;
  published_at: Date | null;
  expires_at: Date | null;
  flag_count: number;
  confirmation_count: number;
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
        flag_count, confirmation_count
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
        flag_count, confirmation_count
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
        flag_count, confirmation_count
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
        flag_count, confirmation_count
    `;

    if (!row) {
      throw new Error(`No such report: ${id}`);
    }

    return this.toReport(row);
  }

  private toReport(row: ReportRow): StoredReport {
    return {
      id: row.id,
      status: row.status,
      categoryId: row.category,
      customCategoryLabel: row.custom_category_label,
      description: row.description,
      timeOfDay: row.time_of_day,
      position: { latitude: row.latitude, longitude: row.longitude },
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
    };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
