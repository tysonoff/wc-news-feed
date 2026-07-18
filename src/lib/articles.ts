// Shared article-query logic for the home feed. Used by BOTH the initial
// server-rendered page load (src/app/page.tsx) and the "Load More" API
// route (src/app/api/articles/route.js) — kept in one place so paging in
// more articles can never drift out of sync with what the first page's
// query actually did (same reasoning as scraper-sources.json being
// shared between the cron route and the manual scraper script).

export const PAGE_SIZE = 50;
const TRENDING_POOL_LIMIT = 300;
const TRENDING_WINDOW_DAYS = 7;

export type ArticleSort = 'latest' | 'trending' | 'weekly' | 'saved';

const KNOWN_SORTS: ArticleSort[] = ['trending', 'weekly', 'saved'];

export function normalizeSort(sort?: string | null): ArticleSort {
  return KNOWN_SORTS.includes(sort as ArticleSort) ? (sort as ArticleSort) : 'latest';
}

// Reddit's "hot" ranking formula, adapted for our net vote_count. It
// blends score and age on a logarithmic scale: early votes count for a
// lot, later votes on the same article count for progressively less, and
// age quietly erodes the score over time — so nothing can camp #1
// forever, but there's no sudden cliff where an article just disappears
// either.
function trendingScore(voteCount: number, publishedAt: string) {
  const order = Math.log10(Math.max(Math.abs(voteCount), 1));
  const sign = voteCount > 0 ? 1 : voteCount < 0 ? -1 : 0;
  const seconds = new Date(publishedAt).getTime() / 1000;
  return sign * order + seconds / 45000;
}

/**
 * Fetches one page of articles (offset/limit) for a given region + sort
 * mode + user. Returns hasMore so the caller knows whether to show a
 * "Load More" button. `supabase` is typed loosely (matches the rest of
 * this codebase) since it may be either the SSR server client or a
 * plain supabase-js client depending on caller.
 */
export async function fetchArticlesPage({
  supabase,
  regionSlug,
  sort,
  userId,
  offset,
  limit = PAGE_SIZE,
}: {
  supabase: any;
  regionSlug: string;
  sort: ArticleSort;
  userId: string | null;
  offset: number;
  limit?: number;
}): Promise<{ articles: any[]; hasMore: boolean; error: string | null }> {
  if (sort === 'saved') {
    if (!userId) return { articles: [], hasMore: false, error: null };

    // Fetch one extra row past `limit` purely to know whether there's a
    // next page, without a separate COUNT query.
    const { data: savedRows, error } = await supabase
      .from('saved_articles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) return { articles: [], hasMore: false, error: error.message };

    const rows = savedRows ?? [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // For saved articles whose original still exists, pull the real
    // current vote count rather than showing a stale/hardcoded number.
    const liveIds = page.map((s: any) => s.article_id).filter(Boolean);
    let liveVoteCounts: Record<string, number> = {};
    if (liveIds.length > 0) {
      const { data: liveArticles } = await supabase
        .from('articles')
        .select('id, vote_count')
        .in('id', liveIds);
      liveVoteCounts = Object.fromEntries((liveArticles ?? []).map((a: any) => [a.id, a.vote_count]));
    }

    // Saved rows carry their own permanent copy of the article's
    // details, so this works even for links whose original article has
    // long since been cleaned up. article_id may be null in that case —
    // ArticleCard uses that to know voting/commenting isn't available
    // anymore, since there's no live article behind it.
    const articles = page.map((s: any) => ({
      id: s.article_id,
      title: s.title,
      url: s.url,
      image_url: s.image_url,
      source_name: s.source_name,
      published_at: s.published_at,
      vote_count: s.article_id ? (liveVoteCounts[s.article_id] ?? 0) : 0,
    }));

    return { articles, hasMore, error: null };
  }

  if (sort === 'trending') {
    // The scoring pool is recomputed on every call (including every
    // "Load More" click) rather than cached — at this app's scale
    // (capped at 300 rows, 30-day retention) that's cheap, and it keeps
    // the ranking correct if votes changed since the last page load
    // instead of serving a stale ordering. Anything beyond the 300-row
    // pool is unreachable via Trending regardless of offset — same
    // inherent limitation the original single-page version had.
    const windowStart = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: pool, error } = await supabase
      .from('articles')
      .select('*')
      .eq('region', regionSlug)
      .gte('published_at', windowStart)
      .limit(TRENDING_POOL_LIMIT);

    if (error) return { articles: [], hasMore: false, error: error.message };

    const sorted = [...(pool ?? [])].sort(
      (a, b) => trendingScore(b.vote_count, b.published_at) - trendingScore(a.vote_count, a.published_at)
    );

    return {
      articles: sorted.slice(offset, offset + limit),
      hasMore: offset + limit < sorted.length,
      error: null,
    };
  }

  // "weekly" and "latest" share the same shape, just a different order().
  let query = supabase.from('articles').select('*').eq('region', regionSlug);

  if (sort === 'weekly') {
    const windowStart = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query
      .gte('published_at', windowStart)
      .order('vote_count', { ascending: false })
      .order('published_at', { ascending: false });
  } else {
    query = query.order('published_at', { ascending: false });
  }

  // Same "fetch one extra to detect hasMore" trick as the saved branch.
  const { data, error } = await query.range(offset, offset + limit);

  if (error) return { articles: [], hasMore: false, error: error.message };

  const rows = data ?? [];
  return {
    articles: rows.slice(0, limit),
    hasMore: rows.length > limit,
    error: null,
  };
}

/**
 * Looks up the signed-in user's profile plus their vote/saved status for
 * a batch of articles. Called once on the initial page load, and again
 * (scoped to just the newly-fetched batch) on every "Load More" click.
 */
export async function enrichWithUserState({
  supabase,
  userId,
  articles,
}: {
  supabase: any;
  userId: string | null;
  articles: any[];
}): Promise<{ profile: any; votesByArticle: Record<string, number>; savedUrls: string[] }> {
  if (!userId || articles.length === 0) {
    return { profile: null, votesByArticle: {}, savedUrls: [] };
  }

  const [{ data: profileData }, { data: voteRows }, { data: savedRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('votes')
      .select('article_id, vote_type')
      .eq('user_id', userId)
      .in('article_id', articles.map((a) => a.id)),
    supabase
      .from('saved_articles')
      .select('url')
      .eq('user_id', userId)
      .in('url', articles.map((a) => a.url)),
  ]);

  return {
    profile: profileData ?? null,
    votesByArticle: Object.fromEntries((voteRows ?? []).map((v: any) => [v.article_id, v.vote_type])),
    savedUrls: (savedRows ?? []).map((s: any) => s.url),
  };
}
