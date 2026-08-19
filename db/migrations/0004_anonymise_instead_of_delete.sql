-- A report leaving the map is anonymised, not deleted.
--
-- Statistics and country profiles are meant to be built later, from questions
-- nobody has asked yet, and a pre-computed summary fixes today's questions in
-- place forever. So the row survives — stripped of everything that ties it to
-- a person.
--
-- Removed on anonymisation: email, name, exact position, description. The
-- description is the field most likely to name someone, so it does not survive.
-- Retained: category, country, a coarse cell, the month, the time of day, the
-- reporter's home country and how many travellers confirmed it. None of that
-- points at an individual.

drop table if exists archive_rows;

alter type report_status add value 'archived';

-- These carried personal data and must be emptiable.
alter table reports
  alter column description drop not null,
  alter column reporter_email_hash drop not null,
  alter column position drop not null,
  alter column public_position drop not null;

alter table reports
  add column anonymised_at timestamptz,
  -- What survives in place of the exact position and date.
  add column retained_month char(7),
  add column cell_latitude numeric(4, 1),
  add column cell_longitude numeric(5, 1);

-- An anonymised row must carry nothing personal. Enforced here so no code path
-- can leave half of it behind.
alter table reports add constraint anonymised_rows_carry_nothing_personal check (
  anonymised_at is null
  or (
    description is null
    and reporter_first_name is null
    and reporter_email_encrypted is null
    and reporter_email_hash is null
    and position is null
    and public_position is null
    and verification_token_hash is null
    and retained_month is not null
    and cell_latitude is not null
    and cell_longitude is not null
  )
);

create index reports_anonymised_idx on reports (retained_month, country_code, category)
  where anonymised_at is not null;
