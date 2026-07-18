import { createClient } from '@/utils/supabase/server'; // Ensure this path matches your structure
import ArticleCard from '@/components/ArticleCard'; // We will create this next
import Link from 'next/link';
import { headers } from 'next/headers';
import { getRegionBySlug } from '@/config/regions';

// Flip this to true once real ads (e.g. AdSense) are ready to go live.
// Keeps the ad slot code intact and easy to re-enable without deleting
// or re-adding anything.
const SHOW_AD_PLACEHOLDERS = false;

// Reddit's "hot" ranking formula, adapted for our net vote_count.
// It blends score and age on a logarithmic scale: early votes count for a
// lot, later votes on the same article count for progressively less, and
// age quietly erodes the score over time — so nothing can camp #1 forever,
// but there's no sudden cliff where an article just disappears either.
function trendingScore(voteCount: number, publishedAt: string) {
  const order = Math.log10(Math.max(Math.abs(voteCount), 1));
  const sign = voteCount > 0 ? 1 : voteCount < 0 ? -1 : 0;
  const seconds = new Date(publishedAt).getTime() / 1000;
  return sign * order + seconds / 45000;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const isTrending = sort === 'trending';
  const isWeekly = sort === 'weekly';
  const isSaved = sort === 'saved';

  // proxy.ts (Next.js's replacement for middleware.ts) tags every request
  // with the region matching the domain it came in on — this is what
  // makes ab.wcnewsfeed.com and sk.wcnewsfeed.com show different articles
  // out of the same shared database.
  const requestHeaders = await headers();
  const region = getRegionBySlug(requestHeaders.get('x-wc-region'));

  // Initialize the Supabase client
  const supabase = await createClient();

  // Figure out who's signed in first, since the Saved tab needs it before
  // it can even query anything.
  const { data: { user } } = await supabase.auth.getUser();

  let articles: any[] = [];
  let fetchError: string | null = null;

  if (isSaved) {
    if (user) {
      const { data: savedRows, error } = await supabase
        .from('saved_articles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        fetchError = error.message;
      } else {
        const rows = savedRows ?? [];

        // For saved articles whose original still exists, pull the real
        // current vote count rather than showing a stale/hardcoded number.
        const liveIds = rows.map((s: any) => s.article_id).filter(Boolean);
        let liveVoteCounts: Record<string, number> = {};
        if (liveIds.length > 0) {
          const { data: liveArticles } = await supabase
            .from('articles')
            .select('id, vote_count')
            .in('id', liveIds);
          liveVoteCounts = Object.fromEntries((liveArticles ?? []).map((a) => [a.id, a.vote_count]));
        }

        // Saved rows carry their own permanent copy of the article's
        // details, so this works even for links whose original article
        // has long since been cleaned up. article_id may be null in
        // that case — ArticleCard uses that to know voting/commenting
        // isn't available anymore, since there's no live article behind it.
        articles = rows.map((s: any) => ({
          id: s.article_id,
          title: s.title,
          url: s.url,
          image_url: s.image_url,
          source_name: s.source_name,
          published_at: s.published_at,
          vote_count: s.article_id ? (liveVoteCounts[s.article_id] ?? 0) : 0,
        }));
      }
    }
  } else if (isTrending) {
    // Pull a reasonably wide pool of recent articles, then rank them by
    // hot score in memory — the formula itself naturally pushes older
    // articles down, so this window is just for efficiency, not a hard cutoff.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pool, error } = await supabase
      .from('articles')
      .select('*')
      .eq('region', region.slug)
      .gte('published_at', sevenDaysAgo)
      .limit(300);

    if (error) {
      fetchError = error.message;
    } else {
      articles = [...(pool ?? [])]
        .sort((a, b) => trendingScore(b.vote_count, b.published_at) - trendingScore(a.vote_count, a.published_at))
        .slice(0, 50);
    }
  } else if (isWeekly) {
    // A simple leaderboard: highest vote count from the last 7 days,
    // no decay math involved — a straightforward complement to Trending.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('region', region.slug)
      .gte('published_at', sevenDaysAgo)
      .order('vote_count', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      fetchError = error.message;
    } else {
      articles = data ?? [];
    }
  } else {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('region', region.slug)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      fetchError = error.message;
    } else {
      articles = data ?? [];
    }
  }

  if (fetchError) {
    return <div className="p-8 text-center text-red-500">Error loading news: {fetchError}</div>;
  }

  let profile = null;
  let votesByArticle: Record<string, number> = {};
  let savedUrls: string[] = [];

  if (user) {
    const [{ data: profileData }, { data: voteRows }, { data: savedRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase
        .from('votes')
        .select('article_id, vote_type')
        .eq('user_id', user.id)
        .in('article_id', articles.map((a) => a.id)),
      supabase
        .from('saved_articles')
        .select('url')
        .eq('user_id', user.id)
        .in('url', articles.map((a) => a.url)),
    ]);

    profile = profileData ?? null;
    votesByArticle = Object.fromEntries((voteRows ?? []).map((v) => [v.article_id, v.vote_type]));
    savedUrls = (savedRows ?? []).map((s) => s.url);
  }

  return (
    <Feed
      articles={articles}
      sort={sort}
      currentUser={user}
      currentProfile={profile}
      votesByArticle={votesByArticle}
      savedUrls={savedUrls}
    />
  );
}

function Feed({
  articles,
  sort,
  currentUser,
  currentProfile,
  votesByArticle,
  savedUrls,
}: {
  articles: any[];
  sort?: string;
  currentUser: any;
  currentProfile: any;
  votesByArticle: Record<string, number>;
  savedUrls: string[];
}) {
  const tabs = [
    { label: 'Latest', value: 'latest' },
    { label: 'Trending', value: 'trending' },
    { label: 'Weekly Top', value: 'weekly' },
    { label: 'Saved', value: 'saved' },
  ];
  const activeSort = ['trending', 'weekly', 'saved'].includes(sort ?? '') ? sort : 'latest';
  const savedSet = new Set(savedUrls);

  return (
    <div className="min-h-screen">
      <main className="max-w-2xl mx-auto py-6">
        {/* Sort toggle */}
        <div className="flex gap-2 px-4 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={`/?sort=${tab.value}`}
              className={`text-sm font-medium px-3 py-1.5 rounded-full transition ${
                activeSort === tab.value
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {activeSort === 'saved' && !currentUser && (
          <p className="px-4 text-sm text-gray-500 dark:text-gray-400">
            Sign in at the top of the page to see your saved articles.
          </p>
        )}

        {activeSort === 'saved' && currentUser && articles.length === 0 && (
          <p className="px-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing saved yet — tap Save on any article to add it here.
          </p>
        )}

        {articles.map((article, index) => (
          <div key={article.url} className="px-4">
            <ArticleCard
              article={article}
              currentUser={currentUser}
              currentProfile={currentProfile}
              initialVote={votesByArticle[article.id] || 0}
              initialSaved={savedSet.has(article.url)}
            />

            {/* Ad Slot Injection: Appears every 5 articles — hidden until
                SHOW_AD_PLACEHOLDERS is flipped to true */}
            {SHOW_AD_PLACEHOLDERS && (index + 1) % 5 === 0 && (
              <div className="my-4 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center text-gray-400 dark:text-gray-500">
                <p className="text-xs uppercase tracking-widest">Advertisement</p>
                <div className="mt-2 h-20 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                  [ Ad Placeholder ]
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}