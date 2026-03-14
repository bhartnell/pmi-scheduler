import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.room_id !== undefined) updates.room_id = body.room_id;
    if (body.day_of_week !== undefined) updates.day_of_week = body.day_of_week;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.block_type !== undefined) updates.block_type = body.block_type;
    if (body.title !== undefined) updates.title = body.title;
    if (body.course_name !== undefined) updates.course_name = body.course_name;
    if (body.content_notes !== undefined) updates.content_notes = body.content_notes;
    if (body.is_recurring !== undefined) updates.is_recurring = body.is_recurring;
    if (body.specific_date !== undefined) updates.specific_date = body.specific_date;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_schedule_blocks')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        room:pmi_rooms!pmi_schedule_blocks_room_id_fkey(id, name, room_type, capacity),
        program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
          id, class_days, color, label,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            id, cohort_number,
            program:programs(id, name, abbreviation)
          )
        ),
        instructors:pmi_block_instructors(
          id, role,
          instructor:lab_users!pmi_block_instructors_instructor_id_fkey(id, name, email)
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ block: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Update schedule block error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('pmi_schedule_blocks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete schedule block error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
