-- Shut the public API off from the tables.
--
-- Supabase serves every table in `public` over PostgREST to anyone holding the
-- project's anon key. That key is designed to be published, so the only thing
-- standing between a stranger and the reports table was row level security —
-- and it was off. The Security Advisor rates this critical, correctly: it
-- meant read, edit and delete on every report, including a reporter's
-- encrypted address and exact position.
--
-- This app never uses PostgREST. It connects straight to Postgres with the
-- service credentials, and the role owning these tables bypasses RLS, so
-- enabling it with no policies is exactly what is wanted: nothing reaches the
-- anonymous API and the application is untouched.
--
-- No policies are added on purpose. A policy would be a door, and there is
-- nobody on that side who should have one.

alter table reports enable row level security;
alter table report_confirmations enable row level security;
alter table report_flags enable row level security;
alter table countries enable row level security;
alter table archive_rows enable row level security;
alter table schema_migrations enable row level security;

-- Belt as well as braces: PostgREST reaches tables through these two roles, so
-- taking the grants away means a policy added later cannot re-open a table by
-- accident. The roles exist only on Supabase — continuous integration runs
-- against a plain PostGIS image, where naming them unconditionally would fail
-- the migration on a database that was never at risk.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on reports, report_confirmations, report_flags,'
         || ' countries, archive_rows, schema_migrations'
         || ' from anon, authenticated';
  end if;
end
$$;

-- `public.spatial_ref_sys` is left alone. It belongs to the PostGIS extension
-- rather than to us, holds nothing but the published EPSG projection
-- definitions, and cannot be altered without owning the extension. The linter
-- keeps flagging it; for this project that is a false positive.

-- The trigger function ran with whatever `search_path` the caller had, which
-- would let a caller able to set that path decide which `reports` table the
-- check reads. Pinning it empty and naming the schema outright removes the
-- question. The rule itself is unchanged.
create or replace function reject_self_confirmation() returns trigger as $$
begin
  if exists (
    select 1 from public.reports
    where id = new.report_id
      and reporter_email_hash = new.confirmer_email_hash
  ) then
    raise exception 'A reporter cannot confirm their own report';
  end if;

  return new;
end;
$$ language plpgsql set search_path = '';
