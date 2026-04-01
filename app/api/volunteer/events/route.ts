import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/volunteer/events — list volunteer events
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase
      .from('volunteer_events')
      .select('*')
      .order('date', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    // Fetch registration counts per event
    const eventIds = (events || []).map((e: { id: string }) => e.id);
    let registrationCounts: Record<string, number> = {};

    if (eventIds.length > 0) {
      const { data: counts } = await supabase
        .from('volunteer_registrations')
        .select('event_id')
        .in('event_id', eventIds)
        .neq('status', 'cancelled');

      if (counts) {
        for (const row of counts) {
          registrationCounts[row.event_id] = (registrationCounts[row.event_id] || 0) + 1;
        }
      }
    }

    const enriched = (events || []).map((e: Record<string, unknown>) => ({
      ...e,
      registration_count: registrationCounts[e.id as string] || 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/volunteer/events — create a volunteer event
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, event_type, date, start_time, end_time, location, description, max_volunteers, linked_lab_day_id } = body;

    if (!name || !date) {
      return NextResponse.json({ success: false, error: 'Name and date are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('volunteer_events')
      .insert({
        name,
        event_type: event_type || 'other',
        date,
        start_time: start_time || null,
        end_time: end_time || null,
        location: location || null,
        description: description || null,
        max_volunteers: max_volunteers || null,
        linked_lab_day_id: linked_lab_day_id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
