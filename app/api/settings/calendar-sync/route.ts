import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/settings/calendar-sync
 * Get current user's calendar sync preferences.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('user_preferences')
    .select('preferences')
    .ilike('user_email', auth.user.email)
    .single();

  const calendarSync = data?.preferences?.calendar_sync || {
    sync_lab_assignments: true,
    sync_lab_roles: true,
    sync_shifts: true,
    sync_site_visits: true,
  };

  return NextResponse.json({ success: true, calendar_sync: calendarSync });
}

/**
 * PUT /api/settings/calendar-sync
 * Update calendar sync preferences.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { sync_lab_assignments, sync_lab_roles, sync_shifts, sync_site_visits } = body;

    const calendarSync = {
      sync_lab_assignments: sync_lab_assignments !== false,
      sync_lab_roles: sync_lab_roles !== false,
      sync_shifts: sync_shifts !== false,
      sync_site_visits: sync_site_visits !== false,
    };

    const supabase = getSupabaseAdmin();

    // Get existing preferences
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('preferences')
      .ilike('user_email', auth.user.email)
      .single();

    const updatedPreferences = {
      ...(existing?.preferences || {}),
      calendar_sync: calendarSync,
    };

    if (existing) {
      const { error } = await supabase
        .from('user_preferences')
        .update({ preferences: updatedPreferences })
        .ilike('user_email', auth.user.email);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_preferences')
        .insert({
          user_email: auth.user.email,
          preferences: updatedPreferences,
        });

      if (error) throw error;
    }

    return NextResponse.json({ success: true, calendar_sync: calendarSync });
  } catch (error) {
    console.error('Error updating calendar sync preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
