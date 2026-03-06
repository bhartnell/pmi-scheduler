import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar/status
 * Returns the current user's Google Calendar connection status.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('lab_users')
    .select('google_calendar_connected, google_calendar_scope')
    .ilike('email', auth.user.email)
    .single();

  const connected = user?.google_calendar_connected ?? false;
  const scope = user?.google_calendar_scope ?? 'freebusy';
  const needsReauth = connected && scope !== 'events';

  return NextResponse.json({
    success: true,
    connected,
    scope,
    needs_reauth: needsReauth,
  });
}
