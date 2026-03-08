import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar/callback
 * Handles the OAuth callback from Google after calendar consent
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const baseUrl = process.env.NEXTAUTH_URL || '';
    return NextResponse.redirect(
      `${baseUrl}/settings?calendar=error&message=not_authenticated`
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const baseUrl = process.env.NEXTAUTH_URL || '';

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings?calendar=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?calendar=error&message=no_code`
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${baseUrl}/api/calendar/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${baseUrl}/settings?calendar=error&message=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      console.error('No refresh_token received from Google');
      return NextResponse.redirect(
        `${baseUrl}/settings?calendar=error&message=no_refresh_token`
      );
    }

    // Calculate token expiry
    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    ).toISOString();

    // Store tokens in lab_users
    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase
      .from('lab_users')
      .update({
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: expiresAt,
        google_calendar_connected: true,
        google_calendar_scope: 'events',
      })
      .ilike('email', session.user.email);

    if (dbError) {
      console.error('Failed to store calendar tokens:', dbError);
      return NextResponse.redirect(
        `${baseUrl}/settings?calendar=error&message=db_error`
      );
    }

    return NextResponse.redirect(`${baseUrl}/settings?calendar=success`);
  } catch (err) {
    console.error('Calendar callback error:', err);
    return NextResponse.redirect(
      `${baseUrl}/settings?calendar=error&message=unexpected_error`
    );
  }
}
