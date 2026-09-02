-- Correction: migration 0010 did nothing.
--
-- It said it took write access to `public.spatial_ref_sys` away from `anon`
-- and `authenticated`. It ran, reported success, and changed nothing. Reading
-- the grants back afterwards still shows:
--
--     anon           DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     authenticated  the same
--
-- Postgres only lets a role revoke grants it made itself. These were made by
-- `supabase_admin`:
--
--     select grantor from information_schema.role_table_grants
--     where table_name = 'spatial_ref_sys' and grantee = 'anon';
--     → supabase_admin
--
-- A revoke that removes nothing succeeds with a warning rather than an error,
-- which is exactly what happened — and the warning ("no privileges could be
-- revoked") was there in the output and read as noise.
--
-- The check that produced 0010 was worthless in a specific and avoidable way:
-- it ran the statement in a rolled-back transaction and treated "no exception"
-- as "it worked". It never read the grants back. A test that cannot fail is
-- not a test, which is a lesson this project has now learned twice.
--
-- Becoming the role that could do it is not open to us either:
--
--     set role supabase_admin;  → permission denied to set role "supabase_admin"
--     alter table public.spatial_ref_sys enable row level security;
--                               → must be owner of table spatial_ref_sys
--
-- So this is not fixable from the application's connection, and 0010 should
-- never have claimed otherwise. It stays in the history because it ran; this
-- file is the correction, because an applied migration cannot be edited
-- without breaking the checksum every later run depends on.
--
-- What remains true about the risk: emptying the table stops country lookup
-- ("Cannot find SRID (4326) in spatial_ref_sys"), and country lookup is how
-- every report gets a country, so it stops reporting. What was overstated: it
-- needs the anon key, and this project never publishes one — there is no
-- Supabase client in the app, no key in the source, and none in the shipped
-- browser code. The exposure is whoever holds the key, not the public.
--
-- Closing it needs Supabase: either they enable row level security on the
-- table, or they revoke the write grants. Until then it is an accepted risk
-- with a named owner outside this repository.

do $$
begin
  raise notice 'spatial_ref_sys: write grants for anon/authenticated remain; see this migration';
end
$$;
