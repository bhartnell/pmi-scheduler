import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/clinical/ride-alongs/assignments — list assignments
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const shiftId = searchParams.get('shift_id');
    const studentId = searchParams.get('student_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('ride_along_assignments')
      .select(`
        *,
        shift:ride_along_shifts(
          id, shift_date, shift_type, start_time, end_time,
          location, unit_number, agency_id, status
        )
      `)
      .order('assigned_at', { ascending: false });

    if (shiftId) query = query.eq('shift_id', shiftId);
    if (studentId) query = query.eq('student_id', studentId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, assignments: data || [] });
  } catch (error) {
    console.error('Error fetching ride-along assignments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

// POST /api/clinical/ride-alongs/assignments — assign a student to a shift
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { shift_id, student_id, notes } = body;

    if (!shift_id || !student_id) {
      return NextResponse.json(
        { success: false, error: 'shift_id and student_id are required' },
        { status: 400 }
      );
    }

    // Check shift exists and has capacity
    const { data: shift } = await supabase
      .from('ride_along_shifts')
      .select('id, max_students, status')
      .eq('id', shift_id)
      .single();

    if (!shift) {
      return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
    }

    if (shift.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Shift is cancelled' }, { status: 400 });
    }

    // Count existing non-cancelled assignments
    const { count } = await supabase
      .from('ride_along_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', shift_id)
      .neq('status', 'cancelled');

    if ((count || 0) >= (shift.max_students || 1)) {
      return NextResponse.json({ success: false, error: 'Shift is full' }, { status: 400 });
    }

    // Check for duplicate assignment
    const { data: existing } = await supabase
      .from('ride_along_assignments')
      .select('id')
      .eq('shift_id', shift_id)
      .eq('student_id', student_id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Student already assigned to this shift' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ride_along_assignments')
      .insert({
        shift_id,
        student_id,
        notes: notes || null,
        assigned_by: user.id,
        status: 'assigned',
      })
      .select()
      .single();

    if (error) throw error;

    // Update shift status if now full
    const { count: newCount } = await supabase
      .from('ride_along_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', shift_id)
      .neq('status', 'cancelled');

    if ((newCount || 0) >= (shift.max_students || 1)) {
      await supabase
        .from('ride_along_shifts')
        .update({ status: 'filled' })
        .eq('id', shift_id);
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error('Error creating ride-along assignment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create assignment' }, { status: 500 });
  }
}
