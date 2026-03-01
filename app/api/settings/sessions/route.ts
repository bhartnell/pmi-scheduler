import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { trackSession } from '@/lib/session-tracker';

// GET — list all active (non-revoked) sessions for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_email', session.user.email)
      .eq('is_revoked', false)
      .order('last_active', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, sessions: data ?? [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch sessions';
    console.error('GET /api/settings/sessions error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — create or update a session record (called on login / page load)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { session_token?: string };
    const sessionToken = typeof body.session_token === 'string' ? body.session_token : undefined;

    const newToken = await trackSession(session.user.email, request, sessionToken);

    // Return the current session record so the client can persist the token
    if (newToken) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', newToken)
        .single();

      return NextResponse.json({ success: true, session: data ?? null, session_token: newToken });
    }

    return NextResponse.json({ success: true, session: null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to track session';
    console.error('POST /api/settings/sessions error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
