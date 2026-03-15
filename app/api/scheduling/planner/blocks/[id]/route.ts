import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const BLOCK_SELECT = `
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
`;

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
    const { update_mode } = body; // 'this' | 'this_and_future' | 'all'

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // Build update payload
    if (body.program_schedule_id !== undefined) updates.program_schedule_id = body.program_schedule_id || null;
    if (body.room_id !== undefined) updates.room_id = body.room_id || null;
    if (body.day_of_week !== undefined) {
      updates.day_of_week = typeof body.day_of_week === 'string'
        ? parseInt(body.day_of_week, 10)
        : body.day_of_week;
    }
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.block_type !== undefined) updates.block_type = body.block_type;
    if (body.title !== undefined) updates.title = body.title || null;
    if (body.course_name !== undefined) updates.course_name = body.course_name || null;
    if (body.content_notes !== undefined) updates.content_notes = body.content_notes || null;
    if (body.color !== undefined) updates.color = body.color || null;
    if (body.is_recurring !== undefined) updates.is_recurring = body.is_recurring;
    if (body.specific_date !== undefined) updates.specific_date = body.specific_date || null;
    if (body.date !== undefined) updates.date = body.date || null;
    if (body.week_number !== undefined) updates.week_number = body.week_number;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    const supabase = getSupabaseAdmin();

    // Handle batch updates for recurring blocks
    if (update_mode === 'this_and_future' || update_mode === 'all') {
      // First get the target block to find its recurring_group_id and date
      const { data: targetBlock, error: fetchError } = await supabase
        .from('pmi_schedule_blocks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (targetBlock?.recurring_group_id) {
        let batchQuery = supabase
          .from('pmi_schedule_blocks')
          .update(updates)
          .eq('recurring_group_id', targetBlock.recurring_group_id);

        if (update_mode === 'this_and_future' && targetBlock.date) {
          batchQuery = batchQuery.gte('date', targetBlock.date);
        }

        const { error: batchError } = await batchQuery;
        if (batchError) throw batchError;

        // Return the updated target block
        const { data: updatedBlock, error: refetchError } = await supabase
          .from('pmi_schedule_blocks')
          .select(BLOCK_SELECT)
          .eq('id', id)
          .single();

        if (refetchError) throw refetchError;

        return NextResponse.json({ block: updatedBlock, batch_updated: true });
      }
    }

    // Single block update (default)
    const { data, error } = await supabase
      .from('pmi_schedule_blocks')
      .update(updates)
      .eq('id', id)
      .select(BLOCK_SELECT)
      .single();

    if (error) throw error;

    return NextResponse.json({ block: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const detail = (err as { details?: string })?.details || '';
    console.error('Update schedule block error:', { message, detail, err });
    return NextResponse.json({
      error: message,
      detail: detail || undefined,
    }, { status: 500 });
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
    const { searchParams } = new URL(request.url);
    const deleteMode = searchParams.get('mode'); // 'this' | 'this_and_future' | 'all'

    const supabase = getSupabaseAdmin();

    if (deleteMode === 'this_and_future' || deleteMode === 'all') {
      // Get the block first
      const { data: targetBlock, error: fetchError } = await supabase
        .from('pmi_schedule_blocks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (targetBlock?.recurring_group_id) {
        let deleteQuery = supabase
          .from('pmi_schedule_blocks')
          .delete()
          .eq('recurring_group_id', targetBlock.recurring_group_id);

        if (deleteMode === 'this_and_future' && targetBlock.date) {
          deleteQuery = deleteQuery.gte('date', targetBlock.date);
        }

        const { error: batchError } = await deleteQuery;
        if (batchError) throw batchError;

        return NextResponse.json({ success: true, batch_deleted: true });
      }
    }

    // Single delete
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
