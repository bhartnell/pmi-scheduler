import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET - Get instructors for a station
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const stationId = searchParams.get('stationId');

    if (!stationId) {
      return NextResponse.json({ success: false, error: 'stationId is required' }, { status: 400 });
    }

    // Try full select first; fall back to basic columns if user_name doesn't exist yet
    let data, error;
    const result = await supabase
      .from('station_instructors')
      .select('id, station_id, user_id, user_email, user_name, is_primary, created_at')
      .eq('station_id', stationId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (result.error?.code === '42703' || result.error?.message?.includes('does not exist')) {
      // user_name column missing — query without it
      const fallback = await supabase
        .from('station_instructors')
        .select('id, station_id, user_id, user_email, is_primary, created_at')
        .eq('station_id', stationId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      data = fallback.data;
      error = fallback.error;
    } else {
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, instructors: data || [] });
  } catch (error: any) {
    console.error('Error fetching station instructors:', error);
    // Handle table not existing
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ success: true, instructors: [], tableExists: false });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch station instructors' }, { status: 500 });
  }
}

// POST - Add instructor to station
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { stationId, userId, userEmail, userName, isPrimary } = body;

    if (!stationId || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'stationId and userEmail are required'
      }, { status: 400 });
    }

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await supabase
        .from('station_instructors')
        .update({ is_primary: false })
        .eq('station_id', stationId);
    }

    // Check if instructor already exists for this station
    const { data: existing } = await supabase
      .from('station_instructors')
      .select('id')
      .eq('station_id', stationId)
      .eq('user_email', userEmail)
      .single();

    let data;
    let error;

    if (existing) {
      // Update existing record — try with user_name, fall back without
      let result = await supabase
        .from('station_instructors')
        .update({
          user_id: userId || null,
          user_name: userName || userEmail.split('@')[0],
          is_primary: isPrimary || false
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (result.error?.code === '42703') {
        result = await supabase
          .from('station_instructors')
          .update({ user_id: userId || null, is_primary: isPrimary || false })
          .eq('id', existing.id)
          .select()
          .single();
      }
      data = result.data;
      error = result.error;
    } else {
      // Insert new record — try with user_name, fall back without
      let result = await supabase
        .from('station_instructors')
        .insert({
          station_id: stationId,
          user_id: userId || null,
          user_email: userEmail,
          user_name: userName || userEmail.split('@')[0],
          is_primary: isPrimary || false
        })
        .select()
        .single();

      if (result.error?.code === '42703') {
        result = await supabase
          .from('station_instructors')
          .insert({
            station_id: stationId,
            user_id: userId || null,
            user_email: userEmail,
            is_primary: isPrimary || false
          })
          .select()
          .single();
      }
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    // Also update the main station's instructor fields for backwards compatibility
    if (isPrimary) {
      await supabase
        .from('lab_stations')
        .update({
          instructor_name: userName || userEmail.split('@')[0],
          instructor_email: userEmail
        })
        .eq('id', stationId);
    }

    // Fire-and-forget: sync Google Calendar event
    try {
      const { syncLabStationAssignment } = await import('@/lib/google-calendar');
      // Look up station → lab_day to get calendar event details
      const { data: station } = await supabase
        .from('lab_stations')
        .select('id, station_number, lab_day_id, scenario:scenarios(title)')
        .eq('id', stationId)
        .single();

      if (station?.lab_day_id) {
        const { data: labDay } = await supabase
          .from('lab_days')
          .select('id, title, date, start_time, end_time, location_id')
          .eq('id', station.lab_day_id)
          .single();

        if (labDay) {
          syncLabStationAssignment({
            userEmail,
            stationId,
            stationNumber: station.station_number,
            labDayId: labDay.id,
            labDayTitle: labDay.title || 'Lab Day',
            labDayDate: labDay.date,
            startTime: labDay.start_time || undefined,
            endTime: labDay.end_time || undefined,
            scenarioTitle: (station.scenario as any)?.title || undefined,
          }).catch(() => {}); // Fire-and-forget
        }
      }
    } catch {
      // Calendar sync is best-effort
    }

    return NextResponse.json({ success: true, instructor: data });
  } catch (error) {
    console.error('Error adding station instructor:', error);
    return NextResponse.json({ success: false, error: 'Failed to add instructor' }, { status: 500 });
  }
}

// DELETE - Remove instructor from station
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const stationId = searchParams.get('stationId');
    const userEmail = searchParams.get('userEmail');

    if (!stationId || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'stationId and userEmail are required'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('station_instructors')
      .delete()
      .eq('station_id', stationId)
      .eq('user_email', userEmail);

    if (error) throw error;

    // Fire-and-forget: remove Google Calendar event
    try {
      const { removeLabStationAssignment } = await import('@/lib/google-calendar');
      removeLabStationAssignment({ userEmail, stationId }).catch(() => {});
    } catch {
      // Calendar sync is best-effort
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing station instructor:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove instructor' }, { status: 500 });
  }
}
