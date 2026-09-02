-- Take write access to the PostGIS projection table away from the public API.
--
-- `public.spatial_ref_sys` is the one table the previous migration could not
-- close. Supabase's linter reports it as "RLS Disabled in Public" and will keep
-- reporting it: the table belongs to `supabase_admin`, and enabling row level
-- security needs its owner. Our role is not one — the attempt fails with
-- "must be owner of table spatial_ref_sys".
--
-- Which would be a footnote if the table held nothing but published EPSG
-- definitions and were readable only. It is not. The grants on it are:
--
--     anon           DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     authenticated  the same
--
-- So anyone holding the anon key — a key designed to be published — can empty
-- it. Doing that does not leak anything, and it is not harmless either. Tried
-- against this database inside a transaction that was rolled back:
--
--     delete from public.spatial_ref_sys;
--     select code from countries where st_dwithin(boundary, …) …
--     ERROR: Cannot find SRID (4326) in spatial_ref_sys
--
-- Country lookup is how every report gets a country, and a report whose
-- country cannot be determined is refused. Emptying this table takes reporting
-- down for everybody. That is the actual finding here, and it is about
-- availability rather than confidentiality.
--
-- SELECT is deliberately left in place. Those 8500 rows are the published EPSG
-- register, they are not ours to hide, and taking read access away could break
-- something in the platform for no gain. Everything that can change them goes.
--
-- This does not silence the linter, and nothing we are able to do would. The
-- finding stays as an accepted one: a flag we cannot set, on a table we do not
-- own, holding no personal data — with the part that could actually hurt us
-- now closed.

do $$
begin
  -- The roles exist only on Supabase; CI runs against a plain PostGIS image.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke insert, update, delete, truncate, references, trigger'
         || ' on public.spatial_ref_sys from anon, authenticated';
  end if;
end
$$;
