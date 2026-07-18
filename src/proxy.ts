import { NextRequest, NextResponse } from 'next/server';
import { getRegionForHost } from '@/config/regions';

// This is the actual mechanism that makes one Next.js app serve multiple
// "sites": every request's Host header is mapped to a region here, and
// the result is forwarded downstream as a request header. Server
// components (layout.tsx, page.tsx) read that header to decide what
// branding to show and which articles to query — nothing below this
// point needs to know about domains at all.
//
// NOTE: as of Next.js 16, the `middleware.ts` file convention was renamed
// to `proxy.ts` (exported function `proxy`, not `middleware`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// This file was deliberately renamed/rewritten to match.
export function proxy(request: NextRequest) {
  const host = request.headers.get('host');
  const region = getRegionForHost(host);

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
