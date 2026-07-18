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

export default function UserCommentsList({ comments, isOwnProfile }) {
  const [items, setItems] = useState(comments);

  const handleDelete = async (commentId) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (!error) {
      setItems((prev) => prev.filter((c) => c.id !== commentId));
    } else {
      console.error('Delete failed:', error.message);
    }
  };

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">No comments yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((comment) => (
        <div key={comment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          {comment.articles ? (
            <a
              href={comment.articles.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
            >
              {comment.articles.title}
            </a>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">Article no longer available</span>
          )}
          <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">{comment.content}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(comment.created_at)}</span>
            {isOwnProfile && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-red-500 dark:text-red-400 text-xs hover:underline p-1 -m-1"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}