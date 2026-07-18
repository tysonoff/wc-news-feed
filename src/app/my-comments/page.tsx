import { createClient } from '@/utils/supabase/server';
import UserCommentsList from '@/components/UserCommentsList';
import Link from 'next/link';

export default async function MyComments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center bg-white dark:bg-gray-900 min-h-screen">
        <p className="text-gray-700 dark:text-gray-300 mb-2">Sign in at the top of the page to see your comments.</p>
        <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          &larr; Back to news feed
        </Link>
      </div>
    );
  }

  const { data: comments } = await supabase
    .from('comments')
    .select('id, content, created_at, article_id, articles(title, url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Your Comments</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Only visible to you.
      </p>

      <UserCommentsList comments={comments ?? []} isOwnProfile={true} />

      <Link href="/" className="block text-center text-sm text-gray-500 dark:text-gray-400 hover:underline mt-8">
        &larr; Back to news feed
      </Link>
    </div>
  );
}