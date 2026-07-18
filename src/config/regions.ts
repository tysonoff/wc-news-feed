// Single source of truth for region metadata used by the app at request
// time (middleware, layout branding, feed queries).
//
// This intentionally duplicates the seed data in
// supabase/migrations/0001_init.sql — the DB table exists so `articles`
// can have a real foreign key and so future admin tooling has something
// to query, but domain-detection itself runs in middleware (Edge
// runtime) on every request, and a static in-memory lookup is faster and
// simpler there than a DB round trip. If you add/change a region, update
// both places.

export type Region = {
  slug: string;
  displayName: string;
  domain: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
};

export const REGIONS: Region[] = [
  {
    slug: 'alberta',
    displayName: 'Alberta',
    domain: 'ab.wcnewsfeed.com',
    brandPrimaryColor: '#0b3d91',
    brandAccentColor: '#f2b705',
  },
  {
    slug: 'saskatchewan',
    displayName: 'Saskatchewan',
    domain: 'sk.wcnewsfeed.com',
    brandPrimaryColor: '#1b5e3f',
    brandAccentColor: '#d4a72c',
  },
  {
    slug: 'manitoba',
    displayName: 'Manitoba',
    domain: 'mb.wcnewsfeed.com',
    brandPrimaryColor: '#a6192e',
    brandAccentColor: '#4a4a4a',
  },
  {
    slug: 'british-columbia',
    displayName: 'British Columbia',
    domain: 'bc.wcnewsfeed.com',
    brandPrimaryColor: '#003087',
    brandAccentColor: '#fcb514',
  },
  {
    slug: 'national',
    displayName: 'National',
    domain: 'wcnewsfeed.com',
    brandPrimaryColor: '#1a1a2e',
    brandAccentColor: '#d52b1e',
  },
];

export const DEFAULT_REGION_SLUG = 'national';

// Name of the cookie a visitor's manual region choice (from the header
// dropdown, RegionSwitcher.tsx) is saved under. Lives here rather than in
// proxy.ts so the client-side switcher component can import it without
// pulling in proxy.ts's next/server (Edge-only) imports into the browser
// bundle.
export const REGION_COOKIE = 'wc-region';

const REGION_BY_DOMAIN = new Map(REGIONS.map((r) => [r.domain, r]));
const REGION_BY_SLUG = new Map(REGIONS.map((r) => [r.slug, r]));

// Strips a leading "www." and any port (useful for localhost:3000 during
// dev, and for Vercel preview URLs which never match a real region
// domain anyway).
function normalizeHost(host: string): string {
  return host.replace(/^www\./, '').replace(/:\d+$/, '');
}

/**
 * Maps an incoming request's Host header to a region. Anything that
 * isn't a recognized region domain (localhost, a Vercel preview URL, a
 * typo'd domain, whatever) falls back to National rather than 404ing —
 * this app should always render something.
 */
export function getRegionForHost(host: string | null | undefined): Region {
  if (!host) return REGION_BY_SLUG.get(DEFAULT_REGION_SLUG)!;
  const normalized = normalizeHost(host);
  return REGION_BY_DOMAIN.get(normalized) ?? REGION_BY_SLUG.get(DEFAULT_REGION_SLUG)!;
}

export function getRegionBySlug(slug: string | null | undefined): Region {
  if (!slug) return REGION_BY_SLUG.get(DEFAULT_REGION_SLUG)!;
  return REGION_BY_SLUG.get(slug) ?? REGION_BY_SLUG.get(DEFAULT_REGION_SLUG)!;
}
