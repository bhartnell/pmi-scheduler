import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/clinical/ride-alongs — list shifts with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const cohortId = searchParams.get('cohort_id');
    const semesterId = searchParams.get('semester_id');
    const agencyId = searchParams.get('agency_id');
    const status = searchParams.get('status');
    const shiftType = searchParams.get('shift_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('ride_along_shifts')
      .select(`
        *,
        assignments:ride_along_assignments(
          id, student_id, status, hours_completed, preceptor_name, notes,
          assigned_at, confirmed_at, completed_at
        )
      `)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (cohortId) query = query.eq('cohort_id', cohortId);
    if (semesterId) query = query.eq('semester_id', semesterId);
    if (agencyId) query = query.eq('agency_id', agencyId);
    if (status) query = query.eq('status', status);
    if (shiftType) query = query.eq('shift_type', shiftType);
    if (startDate) query = query.gte('shift_date', startDate);
    if (endDate) query = query.lte('shift_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, shifts: data || [] });
  } catch (error) {
    console.error('Error fetching ride-along shifts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

// POST /api/clinical/ride-alongs — create a new shift
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      semester_id, cohort_id, agency_id, shift_date, shift_type,
      start_time, end_time, max_students, location, unit_number,
      preceptor_name, notes, status
    } = body;

    if (!shift_date) {
      return NextResponse.json({ success: false, error: 'shift_date is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ride_along_shifts')
      .insert({
        semester_id: semester_id || null,
        cohort_id: cohort_id || null,
        agency_id: agency_id || null,
        shift_date,
        shift_type: shift_type || null,
        start_time: start_time || null,
        end_time: end_time || null,
        max_students: max_students || 1,
        location: location || null,
        unit_number: unit_number || null,
        preceptor_name: preceptor_name || null,
        notes: notes || null,
        status: status || 'open',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift: data });
  } catch (error) {
    console.error('Error creating ride-along shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to create shift' }, { status: 500 });
  }
}
