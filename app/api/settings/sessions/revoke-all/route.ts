import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST — revoke all sessions except the current one
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('user_email', session.user.email)
      .eq('is_current', false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to revoke sessions';
    console.error('POST /api/settings/sessions/revoke-all error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
