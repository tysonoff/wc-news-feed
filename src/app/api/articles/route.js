import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { getRegionBySlug } from '@/config/regions';
import { fetchArticlesPage, enrichWithUserState, normalizeSort, PAGE_SIZE } from '@/lib/articles';

// Powers the "Load More" button on the home feed
// (src/components/ArticleFeedList.js). Returns the next page of
// articles for whatever region/sort the visitor is currently looking
// at, using the exact same query logic as the initial server-rendered
// load (src/app/page.tsx) — both call into src/lib/articles.ts, so
// paging in can't return something inconsistent with what's already on
// screen.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sort = normalizeSort(searchParams.get('sort'));
  const offset = Number(searchParams.get('offset') ?? '0');

  if (!Number.isFinite(offset) || offset < 0) {
    return NextResponse.json({ error: 'Invalid offset' }, { status: 400 });
  }

  // This request goes through proxy.ts the same as any page request, so
  // x-wc-region is already set correctly (from the visitor's region
  // cookie, or domain as a fallback) by the time it gets here — no need
  // to pass region explicitly from the client.
  const requestHeaders = await headers();
  const region = getRegionBySlug(requestHeaders.get('x-wc-region'));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { articles, hasMore, error } = await fetchArticlesPage({
    supabase,
    regionSlug: region.slug,
    sort,
    userId: user?.id ?? null,
    offset,
    limit: PAGE_SIZE,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const { votesByArticle, savedUrls } = await enrichWithUserState({
    supabase,
    userId: user?.id ?? null,
    articles,
  });

  return NextResponse.json({ articles, hasMore, votesByArticle, savedUrls });
}
