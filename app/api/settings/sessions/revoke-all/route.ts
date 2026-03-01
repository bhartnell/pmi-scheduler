import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST — revoke all sessions except the one matching the provided session_token
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { session_token?: string };
    const currentToken = typeof body.session_token === 'string' ? body.session_token : null;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('user_sessions')
      .update({ is_revoked: true })
      .eq('user_email', session.user.email)
      .eq('is_revoked', false);

    // Exclude the current session token so the user doesn't log themselves out
    if (currentToken) {
      query = query.neq('session_token', currentToken);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to revoke sessions';
    console.error('POST /api/settings/sessions/revoke-all error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
