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
| Domain | **safebackpack.app**, registered 2026-08-19 at GoDaddy. Verified with Resend the same day; not yet attached to Vercel. |
| Sending address | **no-reply@safebackpack.app**. That mailbox does not receive — hello@safebackpack.app is where people write. |
| Funding | Free to use. A buymeacoffee.com/safebackpack link exists but is **deliberately not on the site yet** — see §3. |
| Contact | **hello@safebackpack.app** — shown on the site, and the address for privacy and takedown requests. |
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

The form asks for the day it happened. It fills that in with today, which is
what nearly every reporter will leave alone; the field is there for the
traveller who had no connection until they got home. Decided 2026-08-21,
replacing "submission date is also incident date" — the column was already
there for exactly this, so it cost a form field rather than a migration.

Bounds: not further ahead than tomorrow in UTC, and not further back than the
retention ceiling. The upper bound is tomorrow rather than today because the
browser fills the field in from the reporter's *local* clock, which runs a day
ahead of UTC as far east as Kiritimati; a day of slack buys a post-dater
nothing. The lower bound is `MAX_RETENTION_DAYS` rather than a number of its
own, because an incident older than the widest view the map offers has no
window left to be seen in.

Still a date and never a time. The hour is deliberately not collected — see
*Time of day* — and adding one would undo on its own what the coarse bucket
exists to protect.

**The "how recent" filter reads the incident date, not the publication date.**
It offers 24 hours, 1 week, 1 month, 3 months, and the widest window equals the
retention ceiling. Filtering on publication would put last month's robbery under
"past 24 hours" because the paperwork arrived today, and the card beside it
would say "a month ago" — the filter and the report contradicting each other on
the same screen. The consequence is accepted deliberately: a heavily backdated
report is close to the edge of the widest window and so is visible only briefly.
That is what it means for the map to be about recent risk.

Retention is **not** moved. A report lives 60 days from publication whatever day
it describes: backdating says when something happened, and neither buys nor
costs time on the map. There is a test holding that line.

## 2. Legal entity — OPEN

The operating entity (private person CH / private person EU / company) is **not
yet decided**. Consequently all legal pages — imprint, privacy policy, terms —
are built as structured placeholders with jurisdiction-specific fields marked
`TODO`. They must be completed and reviewed by a lawyer before public launch.

Claude does not give legal advice; drafts are starting points only.

## 3. Budget & hosting

Start on free tiers, but **only pick providers with a no-rewrite upgrade path**.

Vercel's Hobby plan forbids commercial use, and a donation link is at best a
grey area. So the buymeacoffee link stays off the site until the project moves
to Pro. Decided 2026-08-19: launch free, add the link and the paid plan
together, which is a switch rather than a change to the code.

| Concern | Choice | Free tier | Upgrade path |
|---|---|---|---|
| Hosting / CI | Vercel | Hobby | Pro (~$20/mo) |
| Database | Postgres + PostGIS | Supabase Free, eu-west-1 (Ireland) | Paid plan, same connection string |
| File storage | Supabase Storage | 1 GB | Paid plan |
| Map tiles | **open — see §7** | | |
| Transactional email | Resend | 3k/mo | Paid plan |
| Rate limiting | Upstash Redis | free tier | Paid plan |
| Moderation | One password, `/admin` | — | — |
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
5. The operator works the queue at `/admin`.

Moderation is one password in the environment, exchanged for a signed session
that lasts a day. Not an account system: there is exactly one person who
moderates, and user accounts to serve one person would be a great deal of
surface area for no benefit. Sign-in attempts are capped at 25 per network
address per hour — room for a typo on two devices, nowhere near enough to
guess.

A held report is invisible to everyone, the operator included, until the queue
is worked. That makes an untouched queue the same as throwing reports away,
which is why the screening rules are deliberately narrow.

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
- Vercel Analytics and Speed Insights are enabled. Both are cookieless and
  store no visitor identifier, so no consent banner is required and the privacy
  notice can still say nothing follows anybody around. Added 2026-08-20.

### Visibility is earned, not granted

A report lives **60 days**. A confirmation from another traveller keeps it for
**30 days from the moment of that confirmation** — not from publication —
because what a confirmation says is "this was still true today", and that
statement ages from today. A hard ceiling of **90 days from publication** means
no chain of confirmations can keep something alive forever.

The extension matters mostly for hazards that persist: a blocked road or a
flooded coast is one event that gets confirmed rather than reported again.
Thefts and scams regenerate on their own — each new victim files a new report,
and it is the count of those that tells a reader something.

See `src/lib/reports/retention.ts`.

Three months, not six. Decided 2026-08-19: a travel-safety report that old is a
historical note rather than a warning, and the shorter period is also easier to
justify to a supervisory authority. The "past 6 months" filter went with it.

Rationale: with travel-safety reports, staleness is the real failure mode. A
landslide gets cleared and a demonstration ends, and an out-of-date warning
damages trust in the whole map more than a missing one does. Long-term
statistics do not depend on keeping the reports themselves — they come from the
anonymous archive below.

### Confirmations

Any verified traveller other than the reporter can say a report **still
applies** or **no longer applies**, once per report. Two "no longer applies"
retire it from the map without anyone moderating.

**No account is required.** The confirmer is identified by the same keyed email
hash as a reporter, so the existing verification and 30-day recognition covers
it. An account would only ever be a more durable form of the same identity,
which is why introducing one later needs no rework. If accounts do arrive with
the iOS app, they will be **passwordless** — emailed sign-in link or platform
biometrics. No self-built password handling, ever.

### Leaving the map means anonymisation, not deletion

When a report's time is up it is **stripped, not removed**. Deleted: the email
address, the reporter's name, the exact position and the free-text description.
Retained indefinitely: category, country, home country, a 0.1° cell (~11 km),
the month, the time of day and the confirmation count.

Rationale: statistics and country profiles — with links to official advice such
as the Swiss FDFA — are meant to come later, from questions nobody has asked
yet. A pre-computed summary fixes today's questions in place forever, while an
anonymised row keeps them open. The description does not survive because it is
the field most likely to name somebody.

A database constraint enforces that an anonymised row carries nothing personal,
so no code path can leave half of it behind. The interface text says all of this
plainly at the review step; a promise of deletion that is not kept would be a
serious problem in a privacy notice, not a wording detail.

See `src/lib/reports/anonymisation.ts` and migration `0004`.

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
- Whether the project goes commercial (decides Vercel Pro).
- How the first reports reach an otherwise empty map.
- Which service screens uploaded photos, once photos are built.
