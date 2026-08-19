# Database

PostgreSQL with PostGIS. Migrations are plain SQL, applied in filename order.

## Applying migrations

Once a database exists and `DATABASE_URL` is set:

```bash
psql "$DATABASE_URL" -f db/migrations/0001_reports.sql
```

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
