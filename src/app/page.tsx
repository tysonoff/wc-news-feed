import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getRegionBySlug } from '@/config/regions';
import { fetchArticlesPage, enrichWithUserState, normalizeSort, PAGE_SIZE } from '@/lib/articles';
import ArticleFeedList from '@/components/ArticleFeedList';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: rawSort } = await searchParams;
  const sort = normalizeSort(rawSort);

  // proxy.ts (Next.js's replacement for middleware.ts) tags every request
  // with the active region — from the visitor's region cookie if they've
  // picked one via the header dropdown, or the domain as a fallback —
  // this is what makes ab.wcnewsfeed.com and the "AB" dropdown option
  // both end up showing Alberta's articles out of the same shared
  // database.
  const requestHeaders = await headers();
  const region = getRegionBySlug(requestHeaders.get('x-wc-region'));

  const supabase = await createClient();

  // Figure out who's signed in first, since the Saved tab needs it before
  // it can even query anything.
  const { data: { user } } = await supabase.auth.getUser();

  const { articles, hasMore, error: fetchError } = await fetchArticlesPage({
    supabase,
    regionSlug: region.slug,
    sort,
    userId: user?.id ?? null,
    offset: 0,
    limit: PAGE_SIZE,
  });

  if (fetchError) {
    return <div className="p-8 text-center text-red-500">Error loading news: {fetchError}</div>;
  }

  const { profile, votesByArticle, savedUrls } = await enrichWithUserState({
    supabase,
    userId: user?.id ?? null,
    articles,
  });

  return (
    <Feed
      articles={articles}
      hasMore={hasMore}
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
  hasMore,
  sort,
  currentUser,
  currentProfile,
  votesByArticle,
  savedUrls,
}: {
  articles: any[];
  hasMore: boolean;
  sort: string;
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
                sort === tab.value
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {sort === 'saved' && !currentUser && (
          <p className="px-4 text-sm text-gray-500 dark:text-gray-400">
            Sign in at the top of the page to see your saved articles.
          </p>
        )}

        {sort === 'saved' && currentUser && articles.length === 0 && (
          <p className="px-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing saved yet — tap Save on any article to add it here.
          </p>
        )}

        <ArticleFeedList
          initialArticles={articles}
          initialHasMore={hasMore}
          sort={sort}
          currentUser={currentUser}
          currentProfile={currentProfile}
          initialVotesByArticle={votesByArticle}
          initialSavedUrls={savedUrls}
        />
      </main>
    </div>
  );
}
