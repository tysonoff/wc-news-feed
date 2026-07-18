# WCNewsFeed.com — Project Handoff

## What this is

A multi-province Western Canadian news aggregator, built as **one shared codebase and
one shared database**, serving different provinces (and eventually a "National" view)
based on which domain someone visits. Not separate sites per province — one app that
looks at the incoming domain and adapts what it shows.

**Starting regions:** Saskatchewan, Manitoba, Alberta, British Columbia, plus a
National News option.

**Important:** this is a *separate* project from an existing site, `sasknewsfeed.com`,
which is being deliberately kept independent (a standalone "test run" that stays as-is).
WCNewsFeed is a fresh build that happens to reuse SaskNewsFeed's proven code as a
starting template — it is not the same live app, and Saskatchewan's content will exist
in both places independently.

## Recommended starting point

Copy the working `sask-news-app` codebase as the literal starting point for this new
project (fresh git repo, fresh GitHub repo, fresh Vercel project, fresh Supabase
project). It already contains a fully working, tested foundation — do not rebuild
these from scratch:

- Magic-link authentication (Supabase Auth, no passwords anywhere)
- Real per-user voting with a `cast_vote` Postgres function (prevents double-voting
  and vote-count manipulation — this took real debugging to get right, don't simplify it)
- Comments, with reporting and per-user delete
- Saved articles (permanent personal copies, independent of the main article
  cleanup cycle)
- Username system: reserved names + profanity filtering, enforced server-side only
  (via a locked-down API route using the Supabase service role key — direct client
  writes to `profiles` are revoked)
- Dark mode (manual toggle via a `.dark` class + Tailwind's `@custom-variant dark`,
  not just system-preference media queries)
- A 30-day article cleanup job, with automatic duplicate-headline cleanup on every sync
- SEO: Open Graph tags, dynamically generated share image (`next/og`), sitemap,
  robots.txt

## Tech stack

- **Next.js** (App Router, TypeScript + plain JS mixed — some components use
  `// @ts-nocheck` deliberately, see Known Gotchas below)
- **Supabase** — Postgres database, Auth, Row Level Security throughout
- **Vercel** — hosting, cron-job.org used for scheduled scraping (Vercel's own free-tier
  cron is once-daily only; cron-job.org gives hourly for free)
- **Tailwind CSS v4**
- **Squarespace** — domain/DNS management (used for sasknewsfeed.com; may differ for
  new domains depending on where they're purchased)

## New architecture needed for multi-region support

None of this exists yet in the source codebase — it needs to be built:

1. **A `regions` table** — slug, display name, domain, brand color per region.
2. **A `region` column on `articles`** — every synced article gets tagged.
3. **Domain-detection logic** — reads the incoming request's domain, determines which
   region to show. This is the actual mechanism that makes one app serve many "sites."
4. **Scraper reorganized by region** — source lists grouped per province instead of one
   flat list; each source's articles get tagged with the correct region on save.
5. **Region-aware duplicate detection** — critical fix, not optional. The current
   Saskatchewan-only version treats any duplicate headline anywhere as bad and drops
   it. In a multi-region app this breaks legitimate national stories that
   correctly appear in multiple provinces — dedup logic must be scoped per-region,
   not global.
6. **A defined "National News" source set** — specific outlets/feeds tagged as
   national-level (CBC national, Global National, etc.), not inferred.
7. **Per-region branding** — logo/color swap based on detected domain (Saskatchewan's
   green/gold shouldn't necessarily be Alberta's colors).

## Known gotchas from building SaskNewsFeed (will very likely recur)

- **Postmedia sites (Leader-Post, StarPhoenix, etc.) actively block automated
  scraping.** This will very likely apply to their papers in other provinces too.
- **CTV has no RSS feeds at all, anywhere** — confirmed directly from CTV's own
  official FAQ. Don't spend time hunting for a CTV feed in any province.
- **Sister-station networks (e.g., Pattison Media's "NOW" sites, Rawlco's
  CJME/CKOM) mix syndicated national/wire content into local feeds**, and often
  duplicate the same story across multiple town-specific sites. Needs the same
  keyword-filter + exact-title-dedup combo used for Saskatchewan.
- **`bad-words` npm package's export style has changed more than once** — check the
  actual installed version's real exports (`node_modules/bad-words/dist/esm/index.js`)
  rather than assuming; this cost multiple failed deploys during the Saskatchewan build.
- **`useState(null)` in plain `.js` files pulled into a TypeScript build can fail
  with a narrow-type inference error.** Fix used throughout: `// @ts-nocheck` as the
  first line of affected files. Not elegant, but deliberate and working.
- **RLS policies and database grants are two separate layers in Postgres** — a
  correct RLS policy does nothing if the base `GRANT` is missing, and vice versa.
  Several real bugs in the Saskatchewan build came from having one but not the other.
  Always check both when something "should" work but doesn't.
- **Windows PowerShell blocks npm by default** in some setups
  (`running scripts is disabled on this system`) — workaround is `npm.cmd` instead
  of `npm`, or `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
  run as Administrator.
- **Supabase free tier has no automatic backups.** Manual export via
  `npx supabase db dump` recommended periodically.

## Security patterns to replicate, not simplify

- Any write that needs to bypass a normal user's restricted permissions (deleting an
  account, validating + creating a username) goes through a Next.js API route using
  the Supabase **service role key** (`SUPABASE_SECRET_KEY`, server-only,
  never exposed to the client) — never trust client-side validation alone for
  anything security-relevant.
- Vote counting is never trusted from the client — always computed by a Postgres
  function (`cast_vote`) using the *real* previous state read inside the same
  transaction, with an advisory lock to prevent race-condition double-counting.
- CRON_SECRET protects the scrape endpoint from being triggered by anyone but the
  scheduled job.

## Suggested first milestone

Don't build all four regions at once. Get **one region (suggest Alberta)** fully
working end-to-end — domain detection, region column, scraper tagging, region-scoped
dedup — before adding Manitoba and BC. Once the architecture is proven on one region,
adding the rest is largely repeating a known process rather than discovering new
problems.
