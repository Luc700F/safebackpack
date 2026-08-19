-- Country boundaries, so a report's country is derived on the server from its
-- coordinates and cannot be chosen by the client.
--
-- The alternative was doing this in Node, which means bundling a 36 MB
-- boundary dataset into every serverless function and rebuilding its index on
-- every cold start. Here it is one indexed query.
--
-- Shapes come from Natural Earth 1:50m (public domain), loaded by
-- scripts/seed-countries.ts. That scale is accurate to a kilometre or two,
-- which is far finer than the question being asked.

create table countries (
  id serial primary key,
  code char(2) not null,
  boundary geography(multipolygon, 4326) not null
);

create index countries_boundary_idx on countries using gist (boundary);
create index countries_code_idx on countries (code);
