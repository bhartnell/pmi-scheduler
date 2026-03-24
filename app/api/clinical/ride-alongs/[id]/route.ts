import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/clinical/ride-alongs/[id] — get single shift with assignments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { data, error } = await supabase
      .from('ride_along_shifts')
      .select(`
        *,
        assignments:ride_along_assignments(
          id, student_id, status, hours_completed, preceptor_name, notes,
          assigned_by, assigned_at, confirmed_at, completed_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift: data });
  } catch (error) {
    console.error('Error fetching ride-along shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch shift' }, { status: 500 });
  }
}

// PUT /api/clinical/ride-alongs/[id] — update a shift
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();

    const {
      semester_id, cohort_id, agency_id, shift_date, shift_type,
      start_time, end_time, max_students, location, unit_number,
      preceptor_name, notes, status
    } = body;

    const updateData: Record<string, unknown> = {};
    if (semester_id !== undefined) updateData.semester_id = semester_id;
    if (cohort_id !== undefined) updateData.cohort_id = cohort_id;
    if (agency_id !== undefined) updateData.agency_id = agency_id;
    if (shift_date !== undefined) updateData.shift_date = shift_date;
    if (shift_type !== undefined) updateData.shift_type = shift_type;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (max_students !== undefined) updateData.max_students = max_students;
    if (location !== undefined) updateData.location = location;
    if (unit_number !== undefined) updateData.unit_number = unit_number;
    if (preceptor_name !== undefined) updateData.preceptor_name = preceptor_name;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from('ride_along_shifts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift: data });
  } catch (error) {
    console.error('Error updating ride-along shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to update shift' }, { status: 500 });
  }
}

// DELETE /api/clinical/ride-alongs/[id] — delete a shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { error } = await supabase
      .from('ride_along_shifts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ride-along shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete shift' }, { status: 500 });
  }
}
