import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { trackSession } from '@/lib/session-tracker';

// GET — list all sessions for the current user
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

    const body = await request.json().catch(() => ({})) as { session_id?: string };
    const sessionId = typeof body.session_id === 'string' ? body.session_id : undefined;

    await trackSession(session.user.email, request, sessionId);

    // Return the current session record so the client can persist the id
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_email', session.user.email)
      .eq('is_current', true)
      .order('last_active', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ success: true, session: data ?? null });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to track session';
    console.error('POST /api/settings/sessions error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
