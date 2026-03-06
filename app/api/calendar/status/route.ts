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
    .select('google_calendar_connected')
    .ilike('email', auth.user.email)
    .single();

  return NextResponse.json({
    success: true,
    connected: user?.google_calendar_connected ?? false,
  });
}
