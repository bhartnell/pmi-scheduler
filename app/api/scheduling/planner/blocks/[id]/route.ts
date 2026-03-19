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
  ),
  linked_lab_day:lab_days!pmi_schedule_blocks_linked_lab_day_id_fkey(
    id, title, date
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
    if (body.linked_lab_day_id !== undefined) updates.linked_lab_day_id = body.linked_lab_day_id || null;

    // Extract instructor_ids from body (handled separately from block field updates)
    const instructorIds: string[] | undefined = Array.isArray(body.instructor_ids) ? body.instructor_ids : undefined;

    const supabase = getSupabaseAdmin();

    // Helper: replace all instructor assignments for a set of block IDs
    async function syncInstructorsForBlocks(blockIds: string[], newInstructorIds: string[]) {
      if (blockIds.length === 0) return;

      // Delete all existing instructor assignments for these blocks
      for (let i = 0; i < blockIds.length; i += 100) {
        const batch = blockIds.slice(i, i + 100);
        await supabase
          .from('pmi_block_instructors')
          .delete()
          .in('schedule_block_id', batch);
      }

      // Insert new assignments for all blocks
      if (newInstructorIds.length > 0) {
        const assignments: { schedule_block_id: string; instructor_id: string; role: string }[] = [];
        for (const blockId of blockIds) {
          for (const instId of newInstructorIds) {
            assignments.push({
              schedule_block_id: blockId,
              instructor_id: instId,
              role: 'primary',
            });
          }
        }
        for (let i = 0; i < assignments.length; i += 100) {
          const batch = assignments.slice(i, i + 100);
          await supabase
            .from('pmi_block_instructors')
            .insert(batch);
        }
      }
    }

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
        // For batch updates, strip per-instance fields that should NOT propagate
        // (each block has its own unique date, day_of_week, and week_number)
        const batchUpdates = { ...updates };
        delete batchUpdates.date;
        delete batchUpdates.day_of_week;
        delete batchUpdates.week_number;
        delete batchUpdates.specific_date;

        // For 'all' mode: update ALL blocks with this recurring_group_id (all days, all weeks)
        // For 'this_and_future': update same day_of_week blocks from this date forward
        let batchQuery = supabase
          .from('pmi_schedule_blocks')
          .update(batchUpdates)
          .eq('recurring_group_id', targetBlock.recurring_group_id);

        if (update_mode === 'this_and_future' && targetBlock.date) {
          // Only filter by day_of_week + date for "this and future" — NOT for "all"
          batchQuery = batchQuery
            .gte('date', targetBlock.date)
            .eq('day_of_week', targetBlock.day_of_week);
        }
        // 'all' mode: no additional filters — updates every block with this recurring_group_id

        const { data: batchResult, error: batchError } = await batchQuery.select('id');
        if (batchError) throw batchError;

        const updatedCount = batchResult?.length || 0;
        const updatedBlockIds = (batchResult || []).map((b: { id: string }) => b.id);
        console.log(`Batch update mode=${update_mode}: recurring_group_id=${targetBlock.recurring_group_id}, updated ${updatedCount} blocks`);

        // Batch sync instructors for all affected blocks
        if (instructorIds !== undefined && updatedBlockIds.length > 0) {
          await syncInstructorsForBlocks(updatedBlockIds, instructorIds);
        }

        // Return the updated target block
        const { data: updatedBlock, error: refetchError } = await supabase
          .from('pmi_schedule_blocks')
          .select(BLOCK_SELECT)
          .eq('id', id)
          .single();

        if (refetchError) throw refetchError;

        return NextResponse.json({ block: updatedBlock, batch_updated: true, updated_count: updatedCount });
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

    // Sync instructors for single block
    if (instructorIds !== undefined) {
      await syncInstructorsForBlocks([id], instructorIds);

      // Re-fetch to include updated instructors
      const { data: refreshed } = await supabase
        .from('pmi_schedule_blocks')
        .select(BLOCK_SELECT)
        .eq('id', id)
        .single();

      return NextResponse.json({ block: refreshed || data });
    }

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
          deleteQuery = deleteQuery
            .gte('date', targetBlock.date)
            .eq('day_of_week', targetBlock.day_of_week);
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
