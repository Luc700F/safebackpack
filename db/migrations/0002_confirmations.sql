-- Confirmations: other travellers vouching for a report, or retiring it.
--
-- Visibility is earned by currency rather than granted by the calendar. A
-- report starts with 30 days; each confirmation adds 30, up to a hard ceiling
-- of 90. Nothing outlives the ceiling. (These numbers were lowered from
-- 90/180 in a later change; src/lib/reports/retention.ts is authoritative.)

create type confirmation_kind as enum ('still_valid', 'no_longer_valid');

alter type report_status add value 'retired';

create table report_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  kind confirmation_kind not null,

  -- Keyed hash of the confirmer's address, same identity as a reporter's.
  -- No account is involved; the existing email verification covers this.
  confirmer_email_hash char(64) not null,

  created_at timestamptz not null default now(),

  -- One person counts once per report. Without this the retention extension
  -- becomes a way to keep your own report alive indefinitely.
  unique (report_id, confirmer_email_hash)
);

create index report_confirmations_report_idx on report_confirmations (report_id);

alter table reports
  add column confirmation_count integer not null default 0,
  add column retirement_count integer not null default 0;

-- The reporter cannot vouch for their own report. Enforced in the service as
-- well; kept here so no code path can bypass it.
create or replace function reject_self_confirmation() returns trigger as $$
begin
  if exists (
    select 1 from reports
    where id = new.report_id
      and reporter_email_hash = new.confirmer_email_hash
  ) then
    raise exception 'A reporter cannot confirm their own report';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger report_confirmations_reject_self
  before insert on report_confirmations
  for each row execute function reject_self_confirmation();
