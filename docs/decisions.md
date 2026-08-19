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
| Platform | Responsive web app, mobile-first. PWA later, no native app. |
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

Country assignment is derived **offline** from the coordinates (point-in-polygon
against a bundled boundary dataset) — no API cost, and a client cannot fake it.

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

## 7. Map provider — OPEN

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

- Map provider (§7).
- Legal entity (§2).
- Grid resolution for the anonymous archive — currently 0.5°, roughly 55 km.
- Support email address shown on the site.
- Whether a severity level is captured per report.
