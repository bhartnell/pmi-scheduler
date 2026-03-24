import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// PUT /api/clinical/ride-alongs/assignments/[id] — update assignment status
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

    const { status, hours_completed, preceptor_name, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (hours_completed !== undefined) updateData.hours_completed = hours_completed;
    if (preceptor_name !== undefined) updateData.preceptor_name = preceptor_name;
    if (notes !== undefined) updateData.notes = notes;

    // Set timestamps based on status transitions
    if (status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('ride_along_assignments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If cancelled, check if shift should be re-opened
    if (status === 'cancelled' && data?.shift_id) {
      const { data: shift } = await supabase
        .from('ride_along_shifts')
        .select('id, max_students, status')
        .eq('id', data.shift_id)
        .single();

      if (shift && shift.status === 'filled') {
        const { count } = await supabase
          .from('ride_along_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('shift_id', data.shift_id)
          .neq('status', 'cancelled');

        if ((count || 0) < (shift.max_students || 1)) {
          await supabase
            .from('ride_along_shifts')
            .update({ status: 'open' })
            .eq('id', data.shift_id);
        }
      }
    }

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error('Error updating ride-along assignment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update assignment' }, { status: 500 });
  }
}
