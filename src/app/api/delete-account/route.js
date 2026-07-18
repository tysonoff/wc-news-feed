import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  // Identify who's calling this using their own signed-in session (read
  // from cookies). This is important: the account to delete is never
  // taken from anything the browser sends directly — it's always
  // whoever is actually signed in on this request. That's what makes
  // it impossible for someone to delete anyone's account but their own.
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // Deleting a user requires admin-level access — only the secret key
  // (never exposed to the browser) can do this.
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // The profiles and comments tables both reference this user with
  // "on delete cascade", so their profile and every comment they wrote
  // are automatically removed too — no extra cleanup code needed here.
  return NextResponse.json({ success: true });
}