// @ts-nocheck
"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ArticleCard({ article, currentUser, currentProfile, initialVote = 0, initialSaved = false }) {
  const [voteCount, setVoteCount] = useState(article.vote_count || 0);
  const [busy, setBusy] = useState(false);
  const [userVote, setUserVote] = useState(initialVote); // 0 = no vote, 1 = upvoted, -1 = downvoted

  const [shareMessage, setShareMessage] = useState('');
  const [saved, setSaved] = useState(initialSaved);
  const [savingArticle, setSavingArticle] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [reportedComments, setReportedComments] = useState(new Set());

  // A saved article whose original has since been cleaned up (past 30
  // days) has no article.id — voting and comments don't apply anymore,
  // since there's no live article (or its comments) left behind them.
  const hasLiveArticle = Boolean(article.id);

  const handleVote = async (clicked) => {
    if (!currentUser || !currentProfile) return; // must be signed in with a profile to vote
    if (busy) return;

    const newVote = clicked === userVote ? 0 : clicked;
    const delta = newVote - userVote;
    if (delta === 0) return;

    setBusy(true);

    const newCount = voteCount + delta;
    const previousVote = userVote;
    const previousCount = voteCount;

    // Optimistic UI update — changes instantly on screen while the real
    // request happens in the background.
    setVoteCount(newCount);
    setUserVote(newVote);

    const supabase = createClient();
    const { error } = await supabase.rpc('cast_vote', {
      p_article_id: article.id,
      p_value: newVote,
    });

    if (error) {
      console.error('Vote failed:', error.message);
      setVoteCount(previousCount);
      setUserVote(previousVote);
    }

    setBusy(false);
  };

  const handleToggleSave = async () => {
    if (!currentUser || savingArticle) return;
    setSavingArticle(true);
    const supabase = createClient();

    if (saved) {
      const { error } = await supabase
        .from('saved_articles')
        .delete()
        .eq('url', article.url)
        .eq('user_id', currentUser.id);
      if (!error) setSaved(false);
    } else {
      // Store a full permanent copy — this keeps working even after the
      // original article eventually gets cleaned up.
      const { error } = await supabase.from('saved_articles').insert({
        user_id: currentUser.id,
        article_id: article.id || null,
        title: article.title,
        url: article.url,
        image_url: article.image_url,
        source_name: article.source_name,
        published_at: article.published_at,
      });
      // A duplicate-save error just means it's already saved — treat
      // that the same as success.
      if (!error || error.code === '23505') setSaved(true);
    }

    setSavingArticle(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url: article.url });
      } catch {
        // person cancelled the share sheet — not an error worth showing
      }
    } else {
      await navigator.clipboard.writeText(article.url);
      setShareMessage('Link copied!');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);

    if (next && comments.length === 0) {
      setLoadingComments(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(username)')
        .eq('article_id', article.id)
        .order('created_at', { ascending: true });

      if (!error) setComments(data);
      setLoadingComments(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || postingComment || !currentUser) return;

    setPostingComment(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('comments')
      .insert({ article_id: article.id, user_id: currentUser.id, content: newComment.trim() })
      .select('*, profiles(username)')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setNewComment('');
    } else {
      console.error('Comment failed:', error?.message);
    }
    setPostingComment(false);
  };

  const handleDeleteComment = async (commentId) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } else {
      console.error('Delete failed:', error.message);
    }
  };

  const handleReportComment = async (commentId) => {
    if (!currentUser) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('comment_reports')
      .insert({ comment_id: commentId, reporter_user_id: currentUser.id });

    // A duplicate-report error (code 23505) just means they already
    // reported this one before — treat that the same as success.
    if (!error || error.code === '23505') {
      setReportedComments((prev) => new Set(prev).add(commentId));
    } else {
      console.error('Report failed:', error.message);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-3 shadow-sm hover:shadow-md transition">
      <div className="flex gap-3">
        {/* Voting Sidebar — only shown while the original article is still live */}
        {hasLiveArticle ? (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleVote(1)}
              disabled={!currentUser || !currentProfile}
              className={`text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 p-2 -m-2 text-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 ${userVote === 1 ? 'text-green-600 dark:text-green-400' : ''}`}
            >
              ▲
            </button>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {voteCount > 0 ? `+${voteCount}` : voteCount}
            </span>
            <button
              onClick={() => handleVote(-1)}
              disabled={!currentUser || !currentProfile}
              className={`text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 p-2 -m-2 text-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 ${userVote === -1 ? 'text-amber-600 dark:text-amber-400' : ''}`}
            >
              ▼
            </button>
          </div>
        ) : (
          <div className="w-6 flex-shrink-0" />
        )}

        {/* Thumbnail (only shows if the article has one) */}
        {article.image_url && (
          <img
            src={article.image_url}
            alt=""
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
          />
        )}

        {/* Content */}
        <div className="flex-1">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 dark:text-gray-100 visited:text-gray-400 dark:visited:text-gray-500"
          >
            <h2 className="text-lg font-medium hover:underline">{article.title}</h2>
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{article.source_name} • {timeAgo(article.published_at)}</p>

          {/* Action Row */}
          <div className="flex gap-2 mt-3 items-center">
            {hasLiveArticle && (
              <button onClick={toggleComments} className="text-sm text-gray-600 dark:text-gray-300 font-medium hover:underline p-2 -m-2">
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </button>
            )}
            <button onClick={handleShare} className="text-sm text-gray-600 dark:text-gray-300 font-medium hover:underline p-2 -m-2">
              Share
            </button>
            <button
              onClick={handleToggleSave}
              disabled={!currentUser}
              className={`text-sm font-medium hover:underline p-2 -m-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                saved ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {saved ? 'Saved' : 'Save'}
            </button>
            {shareMessage && <span className="text-xs text-gray-500 dark:text-gray-400">{shareMessage}</span>}
          </div>
          {!hasLiveArticle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              This article has aged out of the main feed — voting and comments are no longer available.
            </p>
          )}

          {/* Comments Section */}
          {showComments && (
            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
              {loadingComments && <p className="text-sm text-gray-400 dark:text-gray-500">Loading comments...</p>}

              {!loadingComments && comments.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500">No comments yet.</p>
              )}

              <div className="flex flex-col gap-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {comment.profiles?.username || 'Anonymous'}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">{timeAgo(comment.created_at)}</span>
                    {currentUser && comment.user_id === currentUser.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-500 dark:text-red-400 text-xs ml-2 hover:underline p-1 -m-1"
                      >
                        Delete
                      </button>
                    )}
                    {currentUser && comment.user_id !== currentUser.id && (
                      reportedComments.has(comment.id) ? (
                        <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">Reported</span>
                      ) : (
                        <button
                          onClick={() => handleReportComment(comment.id)}
                          className="text-gray-400 dark:text-gray-500 text-xs ml-2 hover:underline p-1 -m-1"
                        >
                          Report
                        </button>
                      )
                    )}
                    <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>
                  </div>
                ))}
              </div>

              {currentUser && currentProfile ? (
                <form onSubmit={handlePostComment} className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    maxLength={500}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  />
                  <button
                    type="submit"
                    disabled={postingComment}
                    className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {postingComment ? 'Posting...' : 'Post'}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Sign in at the top of the page to leave a comment.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}