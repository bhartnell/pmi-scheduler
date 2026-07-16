import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET  /api/adv-cert/pals-hub/agenda-instructors?cohortId=&start=&end=
 * PATCH /api/adv-cert/pals-hub/agenda-instructors  { cohortId, date, blockId, instructorName }
 *
 * Reference-only instructor assignment for the PALS day-of DIDACTIC/VIDEO
 * LESSON ROWS (Task Handoff Queue: "PALS hub - instructor picker on
 * DIDACTIC AGENDA ROWS"). Mirrors lab_stations.instructor_name (PR #46) —
 * pure label for who's teaching each lesson block, no calendar/availability
 * connection, no notifications.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const cohortId = sp.get('cohortId');
  if (!cohortId) {
    return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
  }
  const start = sp.get('start');
  const end = sp.get('end');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('pals_agenda_instructors')
      .select('date, block_id, instructor_name')
      .eq('cohort_id', cohortId);
    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, assignments: data || [] });
  } catch (error) {
    console.error('Error loading PALS agenda instructors:', error);
    return NextResponse.json({ success: false, error: 'Failed to load agenda instructors' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const cohortId = body?.cohortId;
    const date = body?.date;
    const blockId = body?.blockId;
    const instructorName = typeof body?.instructorName === 'string' ? (body.instructorName.trim() || null) : null;

    if (!cohortId || !date || !blockId) {
      return NextResponse.json({ success: false, error: 'cohortId, date, and blockId are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('pals_agenda_instructors')
      .upsert(
        { cohort_id: cohortId, date, block_id: blockId, instructor_name: instructorName, updated_at: new Date().toISOString() },
        { onConflict: 'cohort_id,date,block_id' }
      );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating PALS agenda instructor:', error);
    return NextResponse.json({ success: false, error: 'Failed to update agenda instructor' }, { status: 500 });
  }
}
