# Database

PostgreSQL with PostGIS. Migrations are plain SQL, applied in filename order.

## Applying migrations

With `DATABASE_URL` set in `.env.local`:

```bash
npm run db:migrate            # apply anything outstanding
npm run db:migrate -- --status  # show what is applied and what is not
```

Applied files are recorded in `schema_migrations`, so running it twice is
harmless. A migration that has already been applied is never re-run, and the
runner refuses to continue if one was edited after the fact — write a new file
instead.

## Country boundaries

```bash
npm run db:seed-countries
```

Loads `db/seed/countries.json.gz` into the `countries` table, replacing what is
there. The seed is built from Natural Earth 1:50m (public domain):

```bash
curl -sL -o /tmp/ne50.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
npm run db:build-boundaries -- /tmp/ne50.geojson
```

## Testing against the real database

```bash
npm run test:db
```

Runs the repository contract and the country lookup against `DATABASE_URL`.
These tests skip themselves when no database is configured, so `npm run verify`
stays runnable on a machine without one.

## Conventions

- One file per migration, numbered and never edited once applied. A change means
  a new file.
- Enum values mirror the ids in `src/lib/reports/`. Those ids are permanent —
  renaming one breaks stored rows and existing URLs.
- Constraints carry rules that must hold regardless of which code path writes
  the row. Application-level validation lives in `src/lib/reports/submission.ts`
  and is the friendlier first line, not the only one.

## What is deliberately not here

- **Photos.** Deferred until after the test launch; see `docs/decisions.md`.
- **Rate limit counters.** They live in Redis, not Postgres, because they are
  short-lived and high-write.
