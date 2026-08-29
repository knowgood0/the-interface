# The Interface

A practical AI & technology publication. Original explainers, tool coverage,
and industry analysis — built as a real, working publishing platform with
zero external dependencies (no npm install required to run it).

**This is Phase 1: a working foundation with real content, real SEO
infrastructure, and a real admin panel.** It is not a finished business —
see "What's Not Built Yet" below for exactly what Phase 2 requires.

---

## Why zero dependencies

The whole app runs on Node's built-in `http`, `fs`, and `crypto` modules —
no Express, no React, no build step, no `npm install`. Two reasons:

1. It matches how you've been shipping things — drag-and-drop deployable,
   nothing to compile, easy to read top to bottom.
2. It's genuinely enough for this job. A publishing site is mostly
   server-rendered HTML and a JSON-file-backed CMS; frameworks add
   convenience at the cost of a build step and a dependency tree you'd
   have to maintain.

You can absolutely swap the JSON files for real Postgres later (see
"Scaling the database" below) without touching the routes or templates —
the `lib/db.js` module is the only place that knows articles live in a
JSON file.

## Running it locally

```bash
cd site
cp .env.example .env
# edit .env and set a real ADMIN_PASSWORD
node server.js
```

Visit `http://localhost:3000`. Admin panel: `http://localhost:3000/admin`.

No `npm install` step — there's nothing to install.

## Project structure

```
server.js              — HTTP server + routing (public site)
lib/db.js               — data access layer (JSON files today, swap for Postgres later)
lib/analytics.js        — first-party pageview logging
lib/seo.js               — meta tags, JSON-LD schema, sitemap.xml, rss.xml, robots.txt
views/                   — page templates (plain JS functions returning HTML strings)
admin/                   — admin panel (auth, article CRUD, topic review, settings)
data/                    — articles.json, categories.json, authors.json, topics.json, settings.json
data/static-content.js  — About/Privacy/Terms/Editorial Policy copy (has [FILL IN] fields — see below)
data/logs/pageviews.ndjson — analytics log (created at runtime, gitignored)
public/                 — CSS, client JS, images (served directly, no build step)
scripts/discover-topics.js — RSS-based topic discovery, run via `npm run discover`
```

## Before this goes live: required edits

These aren't optional polish — several are AdSense approval blockers or
legal exposure if left as-is:

1. **`data/authors.json`** — replace the placeholder author with a real
   name and a real, verifiable bio. Google's Discover and Search quality
   systems specifically penalize anonymous or fabricated author credentials
   (confirmed in Google's Feb 2026 Discover update — sites without clear,
   named authorship saw materially reduced Discover distribution).
2. **`data/static-content.js`** — every `[FILL IN]` needs a real value:
   contact email, business email, last-updated dates, and (once you've
   picked one) an affiliate disclosure. The Terms page explicitly needs a
   real liability-limitation clause reviewed by someone who isn't an AI —
   I gave you a structurally correct draft, not legal advice.
3. **`data/settings.json`** — set the real `domain` once you have one.
   Every canonical URL, sitemap entry, and Open Graph tag is built from
   this value.
4. **Replace every placeholder `.svg` image** in `public/images/` with real
   photos/graphics at 1200px+ width, 16:9 ratio. This is a hard Discover
   eligibility requirement, not a nice-to-have — Google's Feb 2026 update
   made page/image experience an explicit eligibility gate, and posts
   without qualifying images get small thumbnails that cut click-through
   by a lot.
5. **`.env`** — set `ADMIN_PASSWORD` to something real. The admin panel
   refuses to authenticate at all if this isn't set (by design — I did not
   want a default password shipping anywhere near production).

## Deployment — static (Cloudflare Pages, drag-and-drop)

This is the recommended path for you given how you've shipped everything
else. `npm run build` reads whatever's currently in `/data` and renders
the entire public site to plain `.html` files in `/dist` — no server, no
Node process, no build tooling beyond that one command.

```bash
node scripts/build-static.js
# or: npm run build
```

Then either:
- **Drag-and-drop:** go to the Cloudflare Pages dashboard → Create a
  project → Upload assets → drag the `dist` folder in. Done.
- **CLI:** `npx wrangler pages deploy dist` (first run will prompt you to
  log in and name the project).

Cloudflare Pages serves clean URLs by default — a request to
`/article/some-slug` automatically resolves to `dist/article/some-slug.html`
at a 200, with no redirect and no trailing slash. That's exactly how this
build is structured, so no routing configuration is needed.

**What's different in the static build vs. the Node server:**
- **Admin panel doesn't exist in `/dist`.** Editing still happens by
  running `node server.js` locally (or hosting it privately somewhere) and
  using `/admin` to edit `data/*.json` — then re-running `npm run build`
  and re-deploying `dist`. The JSON files are the source of truth either
  way; the static site is just a snapshot of them.
- **Search is now client-side.** `/search.html` fetches
  `/search-index.json` (also generated at build time) and filters in the
  browser with plain JS. Fine at hundreds of articles; if the catalog gets
  into the thousands, swap it for a hosted search service like Pagefind or
  Algolia instead.
- **Newsletter form needs a real endpoint.** Without one, the footer just
  shows "Coming soon" instead of a broken form. Once you pick a provider
  (Kit/ConvertKit, Buttondown, etc.), set `newsletterEndpoint` in
  `data/settings.json` to that provider's hosted form action URL and
  rebuild — the form will post directly to them, since there's no server
  here to relay it through.
- **`data/logs/pageviews.ndjson` (the built-in analytics) won't collect
  anything**, because there's no server-side request handler logging
  pageviews anymore. Use Cloudflare Web Analytics (free, one script tag,
  no cookies — add it in the Cloudflare Pages dashboard) or GA4 for a
  static-site-compatible option.

**Workflow going forward:** edit → `npm run build` → drag `dist` into
Cloudflare Pages again (or `wrangler pages deploy dist` if you've connected
it to Git, which also gives you automatic rebuilds on push — worth setting
up once this is live, so you're not manually re-dragging a folder every
time you publish something).

## Deployment — Node server (Render, if you want the live admin panel to be public)

If you'd rather run the admin panel itself in production (edit-and-publish-
instantly, no rebuild step) instead of the build-then-deploy static flow
above, the original Node server still works and is included unchanged.
**Deploy to Render (or Railway, or a small VPS) — not a serverless
platform.** This matters mechanically, not just as a preference: the admin
session store is an in-memory `Map` (see `admin/routes.js`). That's correct
and simple for a single long-running process, but on serverless platforms
(Vercel functions, Cloudflare Workers) each request can hit a cold,
separate instance with an empty session map, which would log you out
randomly. Fixing that requires moving sessions into a real store (Redis,
or a `sessions` table in Postgres) — straightforward, but not built here
because it'd be dead weight until you actually need serverless scaling.

Render steps:
1. Push this to a GitHub repo.
2. New Web Service on Render → connect the repo.
3. Build command: (none needed) · Start command: `node server.js`
4. Add environment variables: `ADMIN_PASSWORD`, `NODE_ENV=production`.
5. Once you have a domain, point it at the Render service and update
   `data/settings.json` → `domain`.

Cost: Render's free/starter tier works fine at low traffic. Budget ~$7/mo
for a service that doesn't spin down (spin-down adds latency to the first
request after idle, which is bad for Core Web Vitals scoring).

## Topic discovery

`npm run discover` fetches a handful of RSS feeds (OpenAI, Anthropic, Ars
Technica, The Verge — edit the list in `scripts/discover-topics.js`) and
adds new candidate topics to the review queue at `/admin/topics`. It never
publishes anything automatically. The scoring is a simple recency
heuristic — a real priority score would pull in actual search-volume data,
which needs one of:
- **Google Trends** — no official API; the unofficial `pytrends`-style
  approaches violate Google's terms and I won't build against them. The
  legitimate route is Search Console data on your *own* content once you
  have some, which tells you what's already working.
- **A paid keyword API** (Ahrefs, Semrush, DataForSEO) — real cost, real
  data. Worth adding once you're publishing consistently enough to need it.
- **Reddit / YouTube trending** — both have official APIs requiring free
  developer credentials; not wired up here, flagging as a clear Phase 2
  addition if you want it.

## Scaling the database

JSON files are genuinely fine up to a few hundred articles and one editor.
Signs you've outgrown it: concurrent editors stepping on each other,
article count in the thousands, or wanting real SQL queries for the
analytics dashboard. When that happens, `lib/db.js` is the only file that
needs to change — swap the `readJSON`/`writeJSON` calls for a Postgres
client (Supabase's free tier is a reasonable landing spot given the stack
you already use elsewhere) and every route/template keeps working
unmodified, since they only ever call `db.articles.*`, never touch files
directly.

---

## What's not built yet (honest gaps)

Being direct about this rather than pretending it's further along than it is:

- **AdSense/Ad Manager integration** — the `adSlot()` component and admin
  settings field exist, but the actual `<ins class="adsbygoogle">` script
  tag is not wired in, because you cannot get an AdSense client ID without
  an approved account, and AdSense will not approve a site with placeholder
  legal pages and demo content. Order of operations: fill in the real
  content and policy pages first, apply, then wire in the real ad code
  (it's a ~10-line addition once you have the ID).
- **Real analytics beyond pageviews** — the built-in logger tracks views,
  referrer source, and top articles. It does not track search queries,
  CTR, or revenue — that requires Google Search Console (free, just needs
  domain verification) and GA4 or a privacy-focused alternative like
  Plausible, neither of which is wired in.
- **Automated draft generation** — the AI-assistance hooks (draft
  generation, headline suggestions) described in the brief aren't built.
  Given the copyright and fabrication risks of automated content
  generation, and that this is explicitly supposed to avoid an "obvious AI
  content farm" outcome, I'd rather you tell me how hands-on you want to
  stay in the editorial loop before I build an automation layer that
  writes copy you haven't reviewed.
- **Newsletter delivery** — the signup form posts to `/newsletter`, which
  currently just redirects with a success message and does nothing with
  the email. It needs a real provider (ConvertKit/Kit, which you've used
  before, or Buttondown) — wiring that in is a small, fast follow-up once
  you pick one.
- **Image pipeline** — no automatic resizing/optimization/responsive
  `srcset` generation yet. Fine at 6 seed articles; worth adding once
  you're publishing regularly (a `sharp`-based resize step at upload time
  in the admin panel is the natural next step, but `sharp` is a compiled
  native dependency, which is the one place a "zero dependencies" stance
  stops being practical).
- **Programmatic SEO** — deliberately not built. Given your actual content
  categories (AI tools, explainers, guides), I don't see a legitimate
  large-scale programmatic angle that wouldn't just be thin pages — the
  brief itself called this out as something to skip unless it's genuinely
  additive, and I don't think it is here yet.

---

## Realistic revenue model

Using the tech-tier AdSense RPM range (roughly $8–15 per 1,000 pageviews
for established sites; new sites typically run 30–40% below that until
domain trust builds — this is publisher-reported industry data, not a
guarantee). Assumes AdSense as the only monetization; affiliate and
newsletter sponsorship would add to this, not replace it.

| Monthly sessions | Est. monthly AdSense revenue (new site, ~$5–9 effective RPM) | At mature RPM (~$8–15) |
|---|---|---|
| 10,000 | $50–$90 | $80–$150 |
| 50,000 | $250–$450 | $400–$750 |
| 100,000 | $500–$900 | $800–$1,500 |
| 500,000 | $2,500–$4,500 | $4,000–$7,500 |
| 1,000,000 | $5,000–$9,000 | $8,000–$15,000 |

Getting from 0 to 10,000 monthly sessions is the hard, slow part — it
depends entirely on consistent publishing and whether Google decides to
trust the site's topical authority, which is not something this codebase
can manufacture for you. Everything above 100k sessions is a "if this
works" number, not a plan.

## What I'd actually do first, in order

1. Fill in the required edits above (30–60 minutes of real work).
2. Write 15–20 real articles before launch, not 6 — topical authority is
   built by depth in a category, not article count alone, but a 6-article
   site reads as thin to both readers and Google.
3. Deploy to Render, verify the domain in Google Search Console, submit
   the sitemap.
4. Apply for AdSense only after step 2–3, with real traffic if possible —
   approval odds are meaningfully better with an established posting
   history than a day-old site.
5. Run `npm run discover` weekly-ish and use the `/admin/topics` queue as
   your actual editorial calendar input, not a fire-and-forget automation.
