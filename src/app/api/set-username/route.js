import { NextResponse } from 'next/server';
import { Filter } from 'bad-words';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

// Only this account is allowed to claim a reserved name below.
const OWNER_EMAIL = 'tysonoff@gmail.com';

// Add or remove names here any time — case doesn't matter, these are
// all compared in lowercase.
const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'staff',
  'support',
  'official',
  'root',
  'system',
  'owner',
  'tyson',
  'tysonoff',
  'sasknewsfeed',
  'sasknews',
];

const filter = new Filter();

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { username } = await request.json();
    const trimmed = (username || '').trim();

    if (trimmed.length < 3 || trimmed.length > 30) {
      return NextResponse.json({ error: 'Display name must be between 3 and 30 characters.' }, { status: 400 });
    }

    const lower = trimmed.toLowerCase();

    const isReserved = RESERVED_USERNAMES.includes(lower);
    const isOwner = user.email === OWNER_EMAIL;
    if (isReserved && !isOwner) {
      return NextResponse.json({ error: 'That name is reserved. Please pick a different one.' }, { status: 400 });
    }

    if (filter.isProfane(trimmed)) {
      return NextResponse.json({ error: 'That name isn\'t allowed. Please pick a different one.' }, { status: 400 });
    }

    // This route is now the only way a profile can be created — direct
    // access has been revoked from regular signed-in users, so this
    // trusted, elevated connection is required to actually write it.
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const { data, error } = await adminClient
      .from('profiles')
      .insert({ id: user.id, username: trimmed })
      .select()
      .single();

    if (error) {
      // A duplicate-username error gets a friendlier message than the raw
      // database error text.
      const message = error.code === '23505'
        ? 'That name is already taken. Please pick a different one.'
        : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ profile: data });
  } catch (err) {
    // Something unexpected broke — surface the real message instead of
    // crashing with an empty response, which used to leave the "Saving..."
    // button stuck forever with nothing to reset it.
    console.error('set-username error:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong. Please try again.' }, { status: 500 });
  }
}