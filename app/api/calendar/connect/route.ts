import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar/connect
 * Redirects to Google OAuth consent screen requesting calendar.freebusy.read scope
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/calendar/callback`;

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'Google OAuth not configured' },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: auth.user.email, // pass email in state for callback verification
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(googleAuthUrl);
}

/**
 * DELETE /api/calendar/connect
 * Disconnects Google Calendar (nulls out tokens, sets connected=false)
 */
export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('lab_users')
    .update({
      google_refresh_token: null,
      google_token_expires_at: null,
      google_calendar_connected: false,
      google_calendar_scope: 'freebusy',
    })
    .ilike('email', auth.user.email);

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect calendar' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
