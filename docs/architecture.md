# Architecture

If you are new to this repository, read this file and `decisions.md`, in that
order. Together they should let you find anything without asking.

## The shape of the app

safebackpack is a single Next.js application (App Router, TypeScript) deployed
on Vercel. There is no separate backend: server logic lives in route handlers
and server components inside the same project.

It is nevertheless **API-first**. A native iOS app may follow, so every data
operation is a versioned JSON endpoint under `src/app/api/v1/`, and the website
is just the first client of it. Server Actions are not used for anything a
second client would also need, because a native app cannot call them.

```
src/
├── app/          Routes only. Thin — a route composes components and calls lib.
│   └── api/v1/   The JSON API. Validates, calls lib, serialises. No logic here.
├── components/   UI. One folder per component: Component.tsx + Component.module.css.
└── lib/          All business logic. No React, no Next.js imports. Heavily tested.
    ├── reports/  Categories, filtering, retention, anonymous archiving.
    └── geo/      Coordinates, grid maths, country lookup.
src/styles/       tokens.css (all design values) and global.css (baseline).
tests/e2e/        Playwright journeys.
docs/             This file, and the decision record.
```

### The one rule that keeps this navigable

**`src/lib` must never import from `src/app` or `src/components`.** Dependencies
point one way: routes → components → lib. Anything that can be decided without a
browser belongs in `lib`, where it is cheap to test and easy to find.

## Styling

All design values — colour, spacing, type, radius, shadow, motion — live in
`src/styles/tokens.css`. Components reference tokens through CSS custom
properties and never hard-code a value. A component's styles live next to it as
a `.module.css` file, so class names are scoped and cannot collide.

There is deliberately **no utility-class framework**. Styling stays out of the
component code so the whole look can be changed by editing tokens alone. Dark
mode is a token swap and needs no component changes.

## Data flow of a report

1. The visitor fills in the form: description, category, photos, position.
2. They see a review step and confirm.
3. They verify their email address; the report stays a draft until they do.
4. Automatic screening checks text and photos.
5. Clean reports publish immediately; suspicious ones enter the moderation queue.
6. The report is visible for six months.
7. A nightly job folds it into an anonymous aggregate and hard-deletes it.

## Time and retention

- `publishedAt` is the single timestamp a report carries: submission time is
  treated as incident time.
- The schema nevertheless keeps `occurredAt` as its own column, defaulting to
  `publishedAt`. If we later let reporters backdate an incident, that is a form
  change rather than a migration.
- `src/lib/reports/retention.ts` owns how long a report lives: 90 days, plus 30
  per confirmation, capped at 180. Nothing else may hard-code those numbers.
- `src/lib/reports/archive.ts` produces the anonymous aggregate that survives
  deletion, so annual risk reporting never depends on retaining personal data.

## Testing

| Layer | Tool | Location | Covers |
|---|---|---|---|
| Unit | Vitest | `src/**/*.test.ts` | Every function in `lib`, every component |
| Integration | Vitest | `src/app/**/*.test.ts` | Route handlers, validation, auth |
| End-to-end | Playwright | `tests/e2e` | Real journeys, in Chromium and WebKit |

`npm run verify` runs lint, types and unit tests — the same gate CI applies.
Coverage must stay at or above 80% on `src/lib`; CI fails below that.

Security-relevant behaviour is tested like any other behaviour. The header test
in `tests/e2e/security-headers.spec.ts` is the pattern: assert the guarantee,
not the implementation.

## Security posture

Baseline headers are set in `next.config.ts`. The Content-Security-Policy needs
a per-request nonce and will live in `proxy.ts` (Next.js 16 renamed
`middleware` to `proxy`), added in the hardening stage together with rate
limiting, upload re-encoding and the admin area.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run verify` | Lint, typecheck and unit tests — run before pushing |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:coverage` | Unit tests with the coverage gate |
| `npm run test:e2e` | Playwright journeys (builds first) |
| `npm run build` | Production build |
