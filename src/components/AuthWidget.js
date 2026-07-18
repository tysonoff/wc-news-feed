// @ts-nocheck
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function AuthWidget() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [sending, setSending] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    const supabase = createClient();

    // Check who's signed in right now
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });

    // Keep this in sync if the user signs in/out in another tab, or right
    // after clicking the magic link
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const handleSendLink = async (e) => {
    e.preventDefault();
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSending(false);
    if (!error) setLinkSent(true);
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    setNameError('');

    try {
      const response = await fetch('/api/set-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: displayName.trim() }),
      });
      const result = await response.json();

      if (!response.ok) {
        setNameError(result.error || 'Something went wrong. Please try again.');
      } else {
        setProfile(result.profile);
      }
    } catch {
      // Covers things like a non-JSON error response — the button used
      // to get stuck on "Saving..." forever in this exact situation.
      setNameError('Something went wrong. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  if (loading) return null;

  // Signed in, but hasn't picked a display name yet
  if (user && !profile) {
    return (
      <form onSubmit={handleSaveName} className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-full px-3 py-1.5 text-sm flex-wrap">
        <span className="text-gray-700 dark:text-yellow-100 whitespace-nowrap">Pick a name:</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. PrairieHawk92"
          maxLength={30}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 w-36"
        />
        <button
          type="submit"
          disabled={savingName}
          className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded px-3 py-1 text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {savingName ? 'Saving...' : 'Save'}
        </button>
        {nameError && <span className="text-red-600 dark:text-red-400 text-xs w-full">{nameError}</span>}
      </form>
    );
  }

  // Fully signed in
  if (user && profile) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
        <a href="/my-comments" className="hidden sm:inline hover:underline">Hi, {profile.username}</a>
        <a href="/settings" className="text-gray-500 dark:text-gray-400 hover:underline">
          Settings
        </a>
      </div>
    );
  }

  // Signed out
  if (linkSent) {
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Check your email for a sign-in link.
      </div>
    );
  }

  return (
    <form onSubmit={handleSendLink} className="flex items-center gap-2 text-sm">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 w-36 sm:w-auto"
      />
      <button
        type="submit"
        disabled={sending}
        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded px-3 py-1 text-sm disabled:opacity-50 whitespace-nowrap"
      >
        {sending ? 'Sending...' : 'Sign in'}
      </button>
    </form>
  );
}