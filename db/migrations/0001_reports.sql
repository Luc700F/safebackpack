-- safebackpack initial schema.
--
-- Two ideas run through this file:
--   1. The exact position a reporter picked never leaves the server. What is
--      served publicly is `public_position`, displaced once at publication.
--   2. Everything personal is deleted after six months. What survives is the
--      anonymous aggregate in `archive_rows`, which carries no personal data
--      and can therefore be kept indefinitely.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations. Values match the ids in src/lib/reports/, which are permanent.
-- ---------------------------------------------------------------------------

create type report_category as enum (
  'robbery', 'theft', 'harassment', 'natural-hazard', 'unrest', 'scam', 'other'
);

create type time_of_day as enum ('day', 'evening', 'night');

create type report_status as enum (
  'pending_verification',  -- filled in, email not confirmed yet
  'screening',             -- confirmed, automated checks running
  'published',             -- publicly visible
  'held_for_review',       -- screening or reader flags raised a concern
  'rejected'               -- moderation removed it
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  status report_status not null default 'pending_verification',

  category report_category not null,
  -- Only used by the 'other' category, where the reporter names it themselves.
  custom_category_label text,
  description text not null,
  time_of_day time_of_day not null,

  -- The position the reporter picked. Server-side only.
  position geography(point, 4326) not null,
  -- Displaced by up to 100 m, written once when the report is published.
  -- Everything public reads this column and never `position`.
  public_position geography(point, 4326),
  -- Derived server-side from `position`, so a client cannot fake it.
  country_code char(2) not null,

  -- Shown on the report. Null when the reporter chose to stay anonymous.
  reporter_first_name text,
  reporter_home_country char(2) not null,
  publish_anonymously boolean not null default false,

  -- Encrypted at rest, deleted together with the report. Used only to send
  -- the verification link and the reporter's own edit/delete link.
  reporter_email_encrypted bytea,
  -- Lets us rate-limit and recognise a returning reporter without keeping a
  -- readable address around.
  reporter_email_hash char(64) not null,

  -- Verification. The token itself is never stored, only its hash.
  verification_token_hash char(64),
  verification_expires_at timestamptz,

  -- Submission time is also incident time. `occurred_at` exists as its own
  -- column so that allowing backdated incidents later is a form change, not a
  -- migration.
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  -- Set on publication to published_at + 180 days. The retention job reads it.
  expires_at timestamptz,

  flag_count integer not null default 0,

  constraint custom_label_only_for_other check (
    (category = 'other' and custom_category_label is not null)
    or (category <> 'other' and custom_category_label is null)
  ),
  constraint anonymous_reports_carry_no_name check (
    (publish_anonymously and reporter_first_name is null)
    or (not publish_anonymously and reporter_first_name is not null)
  ),
  constraint published_reports_are_complete check (
    status <> 'published'
    or (public_position is not null
        and published_at is not null
        and expires_at is not null)
  )
);

-- The public map reads published reports by area; this index carries it.
create index reports_public_position_idx
  on reports using gist (public_position)
  where status = 'published';

create index reports_published_at_idx
  on reports (published_at desc)
  where status = 'published';

create index reports_country_category_idx
  on reports (country_code, category)
  where status = 'published';

-- The retention job scans this.
create index reports_expires_at_idx on reports (expires_at)
  where expires_at is not null;

-- Rate limiting and recognition of a returning reporter.
create index reports_email_hash_idx on reports (reporter_email_hash, created_at);

-- The moderation queue.
create index reports_moderation_idx on reports (created_at)
  where status in ('screening', 'held_for_review');

-- Photos are deliberately absent. They arrive as their own table and their own
-- stage after the test launch; see docs/decisions.md.

-- ---------------------------------------------------------------------------
-- Reader flags
-- ---------------------------------------------------------------------------

create table report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  reason text not null,
  -- Hashed, kept briefly, so one person cannot flag the same report repeatedly.
  reporter_ip_hash char(64) not null,
  created_at timestamptz not null default now(),

  unique (report_id, reporter_ip_hash)
);

create index report_flags_report_idx on report_flags (report_id);

-- ---------------------------------------------------------------------------
-- Anonymous archive
--
-- Written by the retention job immediately before a report is hard-deleted.
-- One row per month x country x category x grid cell. No description, no name,
-- no email, no precise position. This is what annual risk reporting reads.
-- ---------------------------------------------------------------------------

create table archive_rows (
  month char(7) not null,              -- YYYY-MM, UTC
  country_code char(2) not null,
  category report_category not null,
  cell_latitude numeric(5, 2) not null,
  cell_longitude numeric(6, 2) not null,
  count integer not null default 0,

  primary key (month, country_code, category, cell_latitude, cell_longitude)
);

create index archive_rows_country_idx on archive_rows (country_code, month);
