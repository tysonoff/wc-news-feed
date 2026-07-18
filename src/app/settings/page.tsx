// @ts-nocheck
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profileData }) => {
            setProfile(profileData);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Permanently delete your account? This removes your profile and every comment you\'ve made. This cannot be undone.'
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    const response = await fetch('/api/delete-account', { method: 'POST' });

    if (response.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
    } else {
      setDeletingAccount(false);
      alert('Something went wrong deleting your account. Please try again, or contact us.');
    }
  };

  if (loading) {
    return <div className="max-w-lg mx-auto py-10 px-4 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 min-h-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-10 px-4 text-center bg-white dark:bg-gray-900 min-h-screen">
        <p className="text-gray-700 dark:text-gray-300 mb-2">You need to be signed in to view settings.</p>
        <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">Go back and sign in</a>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 bg-white dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Account</h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Display name</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{profile?.username || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Email</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 bg-white dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Actions</h2>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-left text-sm text-gray-700 dark:text-gray-300 hover:underline disabled:opacity-50 p-2 -m-2"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>

        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="text-left text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 p-2 -m-2"
        >
          {deletingAccount ? 'Deleting account...' : 'Delete account'}
        </button>
      </div>

      <a href="/" className="block text-center text-sm text-gray-500 dark:text-gray-400 hover:underline mt-6">
        &larr; Back to news feed
      </a>
    </div>
  );
}
