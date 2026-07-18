// @ts-nocheck
"use client";

import { useState } from 'react';
import ArticleCard from '@/components/ArticleCard';

// Flip this to true once real ads (e.g. AdSense) are ready to go live.
// Keeps the ad slot code intact and easy to re-enable without deleting
// or re-adding anything. Lives here (not page.tsx) since this is the
// component that actually renders the article list now.
const SHOW_AD_PLACEHOLDERS = false;

/**
 * Renders the article list for the home feed and owns the "Load More"
 * button — starts from whatever the server already rendered
 * (initialArticles/initialHasMore, from src/app/page.tsx's first-page
 * fetch), then fetches additional pages from /api/articles and appends
 * them client-side, so revisiting scroll position and existing
 * ArticleCards' local state (vote/save/comments) aren't disturbed.
 */
export default function ArticleFeedList({
  initialArticles,
  initialHasMore,
  sort,
  currentUser,
  currentProfile,
  initialVotesByArticle,
  initialSavedUrls,
}) {
  const [articles, setArticles] = useState(initialArticles);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [votesByArticle, setVotesByArticle] = useState(initialVotesByArticle);
  const [savedUrls, setSavedUrls] = useState(new Set(initialSavedUrls));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    setLoadError('');

    try {
      const params = new URLSearchParams({ sort: sort || 'latest', offset: String(articles.length) });
      const res = await fetch(`/api/articles?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setLoadError(data.error || 'Something went wrong loading more articles.');
        return;
      }

      setArticles((prev) => [...prev, ...data.articles]);
      setHasMore(data.hasMore);
      setVotesByArticle((prev) => ({ ...prev, ...data.votesByArticle }));
      setSavedUrls((prev) => new Set([...prev, ...data.savedUrls]));
    } catch {
      setLoadError('Something went wrong loading more articles.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {articles.map((article, index) => (
        <div key={article.url} className="px-4">
          <ArticleCard
            article={article}
            currentUser={currentUser}
            currentProfile={currentProfile}
            initialVote={votesByArticle[article.id] || 0}
            initialSaved={savedUrls.has(article.url)}
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

      {hasMore && (
        <div className="px-4 mt-2 mb-6 flex flex-col items-center gap-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-sm font-medium px-5 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
          {loadError && <p className="text-xs text-red-500">{loadError}</p>}
        </div>
      )}
    </>
  );
}
