-- A confirmation now extends a report from the moment it was given, not from
-- publication: what a confirmation says is "this was still true today", and
-- that statement ages from today rather than from when the report was written.
--
-- So the count of confirmations is no longer enough to work out when a report
-- expires — the time of the most recent one is what matters.

alter table reports add column last_confirmed_at timestamptz;

-- Backfill from the confirmations already recorded, so existing reports keep
-- the lifetime they have rather than jumping to a new one.
update reports set last_confirmed_at = (
  select max(created_at) from report_confirmations
  where report_confirmations.report_id = reports.id
    and report_confirmations.kind = 'still_valid'
);

-- The retention job scans by expiry; this keeps the confirmation lookup cheap
-- when a report is opened.
create index reports_last_confirmed_idx on reports (last_confirmed_at)
  where last_confirmed_at is not null;
