# safebackpack — Decision Record

Status: **planning**. No code written yet.
Last updated: 2026-08-19

This file records *why* things are the way they are. Update it whenever a decision
changes — it is the entry point for anyone joining the project.

---

## 1. Product

safebackpack lets travellers report safety incidents at a location. Reports are
shown on a world map as a heatmap, filterable by country, category and age.
No user accounts; email verification instead. Reports auto-delete after 6 months.

| Topic | Decision |
|---|---|
| Interface language | **English only.** Data model is i18n-ready so more languages can be added without a rewrite. |
| Audience | Independent travellers / backpackers. |
| Platform | Responsive web app, mobile-first. PWA later. No native app. |

## 2. Legal entity — OPEN

The operating entity (private person CH / private person EU / company) is **not yet
decided**. Consequences: all legal pages (imprint, privacy policy, terms) are built
as **structured placeholders** with the jurisdiction-specific fields marked `TODO`.
They must be completed and reviewed by a lawyer before public launch.

Claude does not provide legal advice; drafts are starting points only.

## 3. Budget & hosting

Start on free tiers, but **only choose providers with a no-rewrite upgrade path**.

| Concern | Choice | Free tier | Upgrade path |
|---|---|---|---|
| Hosting / CI | Vercel | Hobby | Pro (~$20/mo) — required before any commercial use, adds WAF/bot protection |
| Database | Postgres + PostGIS | Supabase Free / Neon Free | Paid plan, same connection string |
| File storage | Supabase Storage | 1 GB | Paid plan |
| Map tiles | MapLibre GL + MapTiler | 100k loads/mo | Paid key, same code |
| Geocoding | MapTiler Geocoding | shared quota | Paid key |
| Transactional email | Resend | 3k/mo | Paid plan |
| Rate limiting | Upstash Redis | free tier | Paid plan |
| Error monitoring | Sentry | free tier | Paid plan |

Country assignment is derived **offline** from coordinates (point-in-polygon against a
bundled country boundary dataset) — no API cost, and it cannot be spoofed by the client.

## 4. Moderation

**Automatic screening, then immediate publication.**

1. On submit, text and images are screened automatically (Claude API for text, image
   classification for photos).
2. Clean reports go live immediately.
3. Suspicious reports go into an admin review queue instead.
4. Readers can flag any live report; 3 flags auto-hide it pending review.
5. An admin backend (login + 2FA — the only account in the system) handles the queue.

Rationale: pre-moderating everything does not scale for a single operator; pure
post-moderation carries too much legal and abuse risk.

## 5. Privacy & victim protection

- Public coordinates are **fuzzed by ~100 m**; exact coordinates are never exposed.
- EXIF metadata (including GPS) is stripped server-side; images are re-encoded.
- Photos containing identifiable people are not allowed.
- Reporters may publish under a pseudonym; country of origin still shows.
- Email addresses are stored encrypted and deleted together with the report.
- IP addresses are stored hashed, for rate limiting only, max 7 days.
- Data is stored in an EU region.

## 6. Code structure & design

- Next.js (App Router) + TypeScript.
- **Styling is fully decoupled from logic**: CSS Modules plus a single central
  `tokens.css` holding all colours, spacing, typography and radii. No utility-class
  framework (Tailwind would put styling back into the components).
- Dark mode comes free via tokens.
- Accessibility target WCAG 2.1 AA — this requires a list view alongside the map.

## 7. Testing

- Unit tests (Vitest) for every business-logic function: validation, filtering,
  geo maths, retention/deletion, rate limiting.
- Integration tests for every API route.
- End-to-end tests (Playwright) for the critical flows: submit → verify → publish,
  filter, edit, delete.
- Security-focused tests: rate limits hold, foreign reports cannot be deleted,
  injected markup is neutralised.
- CI blocks merges on failing tests, lint or type errors. Coverage target 80% on logic.

## 8. Retention

A daily cron job (03:00 UTC) hard-deletes reports older than 6 months, including
their photos and the linked email address. Deletions are recorded in an anonymised
audit log kept for 12 months.

---

## Open questions

See the running list in the conversation. Key ones still unanswered:
domain name, meaning of the "environmental risk" category, whether "country of
residence" and "country of origin" are the same field, visual direction/logo,
support email address, and how the GitHub/Vercel credentials get set up.
