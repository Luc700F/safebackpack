# safebackpack — Decision Record

Status: **stage 1 complete** — foundation, design tokens, test setup, CI.
Last updated: 2026-08-19

This file records *why* things are the way they are. Update it whenever a
decision changes. Read `architecture.md` next.

---

## 1. Product

safebackpack lets travellers report safety incidents at a location. Reports show
on a world map as a heatmap, filterable by country, category and age. No user
accounts; email verification instead. Reports auto-delete after six months.

| Topic | Decision |
|---|---|
| Interface language | **English only.** Data model stays translatable so more languages can be added without a rewrite. |
| Audience | Independent travellers / backpackers. |
| Platform | Responsive web app, mobile-first. **A native iOS app is possible later**, which is why the app is built API-first — see §8. |
| Photos | **Not in the first usable build.** Uploads are the most expensive and legally riskiest part (EXIF stripping, re-encoding, automated screening, storage). They become their own stage after the test launch, once the rest works. |
| Domain | None yet — the Vercel URL is used until public launch. |
| Logo | Placeholder wordmark; a real identity comes before launch. |

### Categories

Seven, fixed. Ids are permanent (stored in the database, used in URLs); labels
are free to change. Defined in `src/lib/reports/categories.ts`.

`robbery` · `theft` · `harassment` · `natural-hazard` · `unrest` · `scam` · `other`

`natural-hazard` means physical danger from the environment — earthquakes,
tsunamis, floods, landslides, blocked or washed-out roads. It is **not** about
pollution or environmental damage.

`other` is the only category where the reporter supplies their own wording. That
wording is displayed but is not a filter value, so filters stay meaningful.

### Reporter identity

One field, "home country" (ISO 3166-1 alpha-2), shown on the report together
with the reporter's first name. Country of origin and country of residence are
treated as the same thing.

### Severity

Not asked of the reporter — the category implies it. Each category carries a
fixed weight between 0 and 1 that drives heatmap intensity, defined next to the
category in `src/lib/reports/categories.ts`:

| Category | Weight |
|---|---|
| `robbery` | 1.0 |
| `harassment` | 0.9 |
| `natural-hazard` | 0.7 |
| `unrest` | 0.5 |
| `other` | 0.5 |
| `theft` | 0.4 |
| `scam` | 0.3 |

Rationale: a pickpocketing is inherently less severe than an armed robbery, and
reporters cannot rate severity consistently. Further nuance — "armed", "at
gunpoint" — belongs in the description. Changing the map's emphasis later means
editing seven numbers in one file, and it applies retroactively to reports
already filed.

### Time of day

Three buckets, taken from the reporter's **local** hour in the browser:

| Bucket | Hours |
|---|---|
| `day` | 06:00–18:00 |
| `evening` | 18:00–21:00 |
| `night` | 21:00–06:00 |

Stored as the bucket, never as a precise time. Coarse enough that place, date
and time together do not single out one person; useful enough to show that a
street is fine by day and not after dark. Deriving it server-side from a UTC
timestamp would mislabel every report filed outside the server's timezone.
See `src/lib/reports/time-of-day.ts`.

### Time

The submission date is also the incident date; there is no separate field in the
form. The schema still keeps `occurredAt` as its own column defaulting to
`publishedAt`, so allowing backdated incidents later is a form change rather
than a migration.

The "how recent" filter offers 24 hours, 1 week, 1 month, 3 months, 6 months.
The widest window equals the retention period, so it always means "everything".

## 2. Legal entity — OPEN

The operating entity (private person CH / private person EU / company) is **not
yet decided**. Consequently all legal pages — imprint, privacy policy, terms —
are built as structured placeholders with jurisdiction-specific fields marked
`TODO`. They must be completed and reviewed by a lawyer before public launch.

Claude does not give legal advice; drafts are starting points only.

## 3. Budget & hosting

Start on free tiers, but **only pick providers with a no-rewrite upgrade path**.

| Concern | Choice | Free tier | Upgrade path |
|---|---|---|---|
| Hosting / CI | Vercel | Hobby | Pro (~$20/mo) — required before any commercial use, adds WAF |
| Database | Postgres + PostGIS | Supabase Free | Paid plan, same connection string |
| File storage | Supabase Storage | 1 GB | Paid plan |
| Map tiles | **open — see §7** | | |
| Transactional email | Resend | 3k/mo | Paid plan |
| Rate limiting | Upstash Redis | free tier | Paid plan |
| Error monitoring | Sentry | free tier | Paid plan |

Country assignment is derived **server-side in PostGIS**, by a point-in-polygon
test against a `countries` table with a spatial index — no API cost, and a client
cannot fake it. Doing the same in Node was tried and rejected: the boundary
dataset is 36 MB, which would be bundled into every serverless function and
re-indexed on every cold start. The database already holds geometry and answers
this in one indexed query. Until the database exists, `CountryLocator` has a
static test implementation.

## 4. Moderation

**Automatic screening, then immediate publication.**

1. On submit, text and images are screened automatically.
2. Clean reports go live immediately.
3. Suspicious reports enter an admin review queue instead.
4. Readers can flag any live report; three flags auto-hide it pending review.
5. An admin area (login plus 2FA — the only account in the system) works the queue.

Rationale: pre-moderating everything does not scale for a single operator; pure
post-moderation carries too much legal and abuse risk.

## 5. Privacy, retention and annual statistics

- Public coordinates are fuzzed by roughly 100 m; exact coordinates are never exposed.
- EXIF metadata including GPS is stripped server-side; images are re-encoded.
- Photos showing identifiable people are not allowed.
- Reporters may publish under a pseudonym; the home country still shows.
- After verifying once, a reporter is recognised in the same browser for
  **30 days** and need not verify again — a compromise between not sending
  travellers to their inbox on every report and limiting abuse.
- Email addresses are stored encrypted and deleted with the report.
- IP addresses are stored hashed, for rate limiting only, at most 7 days.
- Data is stored in an EU region.

Reports are hard-deleted after 180 days. To still allow annual risk reporting,
each report is folded into an **anonymous aggregate** before deletion:
month × country × category × coarse grid cell → count. No description, no
photos, no email, no name, and no precise position survives. Because the
aggregate carries no personal data, it can be kept indefinitely.
See `src/lib/reports/archive.ts`.

## 6. Code structure, design and testing

- Next.js 16 (App Router) + TypeScript, React 19.
- `src/lib` holds all business logic and imports no framework code.
- **Styling is fully decoupled from logic**: CSS Modules plus one central
  `src/styles/tokens.css`. No utility-class framework — Tailwind would put
  styling back into the components.
- Visual direction: modern, calm and uncluttered — generous whitespace, soft
  rounded cards, a warm neutral palette with one teal accent. Inspired by the
  feel of apps like Tripsy, not copied from them.
- Dark mode is a token swap.
- Accessibility target WCAG 2.1 AA, which requires a list view beside the map.
- Vitest for unit and integration tests, Playwright for journeys in Chromium
  and WebKit. CI blocks merges on lint, type, test or coverage failures.

## 7. API-first, because of a possible iOS app

A native iOS app may follow. That does not change what we build now, but it
changes *how*, and getting it wrong would be expensive to undo:

- **Every data operation goes through a versioned JSON API** under `/api/v1/`.
  The website is simply the first client of that API, not a special case.
- **No Next.js Server Actions for anything a second client would also need.**
  Server Actions are a web-only mechanism; a native app cannot call them. They
  stay allowed for purely web concerns such as a cookie preference.
- **The recognition token is a plain signed string**, so it works as a browser
  cookie today and as an `Authorization: Bearer` header from an app later,
  without a second identity mechanism.
- **Business logic stays in `src/lib`**, never inside a route handler. A route
  handler validates, calls into `lib`, and serialises the result.
- Error responses use one documented shape, so a second client does not have to
  guess at them.

What this does *not* mean: no separate backend service, no React Native, and no
work on the app itself now. The design system and CSS are web-only; a native app
would bring its own interface.

On iOS, MapKit is free and native regardless of which map the website uses, so
§8 is a web decision only.

## 8. Map provider — OPEN

Apple Maps is the preferred look, but it comes with constraints:

- MapKit JS requires an **Apple Developer Program membership (~$99/year)**,
  which conflicts with the "free tier for now" decision. Its free quota is
  otherwise generous: 250,000 map views and 25,000 service calls per day.
- MapKit JS has **no built-in heatmap layer**. The heatmap would have to be
  drawn manually onto a canvas overlay.

The alternative is MapLibre GL with a clean vector style, which is free, has a
native heatmap layer, and can be styled to look close to Apple Maps.

Either way the map is placed behind a small internal interface so the provider
can be swapped without touching the rest of the app.

---

## Open questions

Needed before the map stage:

- Map provider (§8).
- Whether heatmap intensity also decays with age, on top of the category weight.
- The zoom level at which individual reports replace the heatmap.
- Grid resolution for the anonymous archive — currently 0.5°, roughly 55 km.
- Whether each country gets its own statistics page.

Needed before public launch:

- Legal entity (§2), and a lawyer's review of the legal pages.
- Support email address shown on the site.
- **Domain — needed earlier than expected.** Until a domain is verified with
  Resend, verification emails can only be sent to the account owner's own
  address. Development and testing work fine; a public test with real users
  does not.
- Whether the project goes commercial (decides Vercel Pro).
- How the first reports reach an otherwise empty map.
- Which service screens uploaded photos, once photos are built.
