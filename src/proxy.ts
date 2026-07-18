import { NextRequest, NextResponse } from 'next/server';
import { getRegionForHost, getRegionBySlug, REGIONS, REGION_COOKIE } from '@/config/regions';

const VALID_SLUGS = new Set(REGIONS.map((r) => r.slug));

// This is the actual mechanism that makes one Next.js app serve multiple
// "sites": every request gets mapped to a region here, and the result is
// forwarded downstream as a request header. Server components
// (layout.tsx, page.tsx) read that header to decide what branding to
// show and which articles to query — nothing below this point needs to
// know about domains or cookies at all.
//
// Region resolution order:
//   1. A manually-picked region saved in the wc-region cookie (from the
//      dropdown in the header) — lets one single domain serve every
//      region without needing ab.wcnewsfeed.com/sk.wcnewsfeed.com/etc to
//      actually exist yet.
//   2. Falls back to domain detection (getRegionForHost) — so if/when
//      per-region domains ARE set up later, they still work automatically
//      with zero code changes; a visitor just won't have a cookie yet.
//
// NOTE: as of Next.js 16, the `middleware.ts` file convention was renamed
// to `proxy.ts` (exported function `proxy`, not `middleware`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// This file was deliberately renamed/rewritten to match.
export function proxy(request: NextRequest) {
  const cookieSlug = request.cookies.get(REGION_COOKIE)?.value;
  const region =
    cookieSlug && VALID_SLUGS.has(cookieSlug)
      ? getRegionBySlug(cookieSlug)
      : getRegionForHost(request.headers.get('host'));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-wc-region', region.slug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next's own internals —
    // no point paying the header-rewrite cost for /_next/* or files with
    // an extension (images, favicon, etc).
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
