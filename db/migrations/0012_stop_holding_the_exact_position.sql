-- Drop the exact position of reports that are already published.
--
-- From now on `publish` records the coarse cell and clears `position` in the
-- same statement. Rows published before that change still carry a coordinate
-- they no longer need: the map has always drawn the blurred position, and the
-- only later reader was the retention job working out this same cell.
--
-- Why it is worth a migration rather than letting them age out: Supabase
-- installs PostGIS into `public` owned by `supabase_admin`, which leaves
-- `st_estimatedextent` executable by `anon` — a SECURITY DEFINER function that
-- reports an approximate bounding box of a column, and ignores the grants we
-- are able to revoke. Tried as `anon` against this database:
--
--     select st_estimatedextent('public','reports','position');
--     → BOX(-0.4268 -0.9679, 0.7556 0.9646)
--
-- With few reports that box is close to being one report's location. A column
-- that does not exist cannot be estimated, which is the only lever on this that
-- belongs to us.
--
-- The snapping is done in `numeric` rather than double precision on purpose.
-- 13.7 / 0.1 is 136.99999999999997 in binary floating point and would land the
-- point one cell south; exact decimal arithmetic has no such edge, and agrees
-- with `toGridCell` in src/lib/reports/anonymisation.ts.
--
-- Unpublished reports keep their position. They have not been blurred yet, so
-- it is still the only copy there is.

update reports
set
  cell_latitude = floor(st_y(position::geometry)::numeric / 0.1) * 0.1,
  cell_longitude = floor(st_x(position::geometry)::numeric / 0.1) * 0.1,
  position = null
where published_at is not null
  and position is not null;
