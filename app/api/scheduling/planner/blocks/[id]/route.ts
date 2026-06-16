import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import {
  assignSemesterId,
  cohortIdForProgramSchedule,
} from '@/lib/planner-semester';
import { applyInstructorDiff, type InstructorDiff } from '@/lib/calendar-auto-sync';

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
    id, role, instructor_id,
    instructor:lab_users!pmi_block_instructors_instructor_id_fkey(id, name, email)
  ),
  linked_lab_day:lab_days!pmi_schedule_blocks_linked_lab_day_id_fkey(
    id, title, date
  )
`;

/**
 * Fire-and-forget calendar diff after a planner block update.
 * Resolves OLD vs NEW instructor emails from the lab_users.id values
 * we have, then hands the diff to applyInstructorDiff() which calls
 * removeSeriesForUser / syncSeriesForUser per affected user.
 *
 * Wrapped in try/catch and never throws — calendar sync is
 * best-effort. Logs outcomes for debugging.
 */
async function fireInstructorAutoSync(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pre: { recurring_group_id: string | null; instructor_id: string | null; additional_instructor_id: string | null },
  post: { id: string; recurring_group_id: string | null; instructor_id: string | null; additional_instructor_id: string | null }
): Promise<void> {
  try {
    const oldIds = [pre.instructor_id, pre.additional_instructor_id].filter(Boolean) as string[];
    const newIds = [post.instructor_id, post.additional_instructor_id].filter(Boolean) as string[];
    const allIds = Array.from(new Set([...oldIds, ...newIds]));
    if (allIds.length === 0) return;

    // Resolve email map for the union of old/new IDs in one round-trip.
    const { data: users } = await supabase
      .from('lab_users')
      .select('id, email')
      .in('id', allIds);
    const idToEmail = new Map<string, string>();
    for (const u of users ?? []) idToEmail.set(u.id, (u.email as string).toLowerCase());

    const oldEmails = new Set(oldIds.map(i => idToEmail.get(i)).filter(Boolean) as string[]);
    const newEmails = new Set(newIds.map(i => idToEmail.get(i)).filter(Boolean) as string[]);

    const diff: InstructorDiff = {
      // Use the recurring group from EITHER pre- or post-state (they
      // shouldn't differ — the planner UI doesn't allow moving a
      // block between groups). post wins when set.
      recurringGroupId: post.recurring_group_id ?? pre.recurring_group_id ?? null,
      blockIdForOneOff:
        post.recurring_group_id || pre.recurring_group_id ? null : post.id,
      oldEmails,
      newEmails,
    };

    const results = await applyInstructorDiff(diff);
    for (const r of results) {
      if (r.result.status === 'failed') {
        console.warn(`[planner-block PUT] auto-sync ${r.action} failed for ${r.email}:`, 'error' in r.result ? r.result.error : '');
      } else {
        console.log(`[planner-block PUT] auto-sync ${r.action} ${r.result.status} for ${r.email}`);
      }
    }
  } catch (err) {
    console.error('[planner-block PUT] fireInstructorAutoSync error:', err);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let blockId = 'unknown';
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    blockId = id;
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
    // Direct-FK instructor columns (Scheduling Overhaul follow-up).
    // Distinct from the legacy pmi_block_instructors many-to-many —
    // these mirror the lab_stations.instructor_id pattern and feed
    // the coordinator-calendar 5th data source. Empty string + null
    // both clear the slot so the picker can deassign.
    if (body.instructor_id !== undefined) updates.instructor_id = body.instructor_id || null;
    if (body.additional_instructor_id !== undefined) {
      updates.additional_instructor_id = body.additional_instructor_id || null;
    }

    // Extract instructor_ids from body (handled separately from block field updates)
    const instructorIds: string[] | undefined = Array.isArray(body.instructor_ids) ? body.instructor_ids : undefined;

    const supabase = getSupabaseAdmin();

    // Calendar auto-sync prep: pre-capture the OLD instructor IDs and
    // recurring_group_id BEFORE we run the UPDATE, so the post-update
    // diff knows who used to be assigned. Only relevant when the
    // request actually touches an instructor slot — skip the round-
    // trip otherwise.
    const instructorTouched =
      body.instructor_id !== undefined ||
      body.additional_instructor_id !== undefined;
    let preInstructorState: {
      recurring_group_id: string | null;
      instructor_id: string | null;
      additional_instructor_id: string | null;
    } | null = null;
    if (instructorTouched) {
      const { data: pre } = await supabase
        .from('pmi_schedule_blocks')
        .select('recurring_group_id, instructor_id, additional_instructor_id')
        .eq('id', id)
        .single();
      preInstructorState = pre ?? null;
    }

    // Year-anchor: re-derive semester_id whenever date or
    // program_schedule_id changes (or when the caller explicitly
    // passes semester_id / force_semester_override). Fetches the
    // current row when needed so we use the EFFECTIVE date / cohort
    // — i.e. body.date if supplied else the row's existing date —
    // rather than only what's in the partial update.
    const semesterTouched =
      body.date !== undefined ||
      body.program_schedule_id !== undefined ||
      body.semester_id !== undefined ||
      body.force_semester_override !== undefined;
    if (semesterTouched) {
      let effectiveDate: string | null = body.date ?? null;
      let effectiveProgramScheduleId: string | null = body.program_schedule_id ?? null;
      // Pull the current row only when we don't already have all the
      // inputs we need from the body. Avoids an extra round-trip on
      // a "user changed only the date AND program_schedule" edit.
      if (body.date === undefined || body.program_schedule_id === undefined) {
        const { data: existing } = await supabase
          .from('pmi_schedule_blocks')
          .select('date, program_schedule_id')
          .eq('id', id)
          .single();
        if (body.date === undefined) effectiveDate = existing?.date ?? null;
        if (body.program_schedule_id === undefined) {
          effectiveProgramScheduleId = existing?.program_schedule_id ?? null;
        }
      }
      const cohortIdForResolve = await cohortIdForProgramSchedule(
        supabase,
        effectiveProgramScheduleId
      );
      const resolvedSemesterId = await assignSemesterId(supabase, {
        date: effectiveDate,
        clientSemesterId: body.semester_id ?? null,
        cohortId: cohortIdForResolve,
        forceOverride: !!body.force_semester_override,
      });
      // Only stamp semester_id when the resolver actually picked
      // something — avoids null-stamping a row that already had a
      // valid semester_id assigned by a prior write.
      if (resolvedSemesterId) {
        updates.semester_id = resolvedSemesterId;
      }
    }

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

        // Calendar auto-sync for the recurring-group change. The
        // diff applies once at the SERIES level (not per-block) —
        // recurring_group_id is shared across the batch, so a
        // single push/remove is the right thing to do.
        if (instructorTouched && preInstructorState) {
          void fireInstructorAutoSync(supabase, preInstructorState, updatedBlock);
        }

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

      // Calendar auto-sync (instructor change diff). See helper
      // below — kicked off as fire-and-forget so the PUT response
      // returns immediately; Google API failures are logged but
      // never block the planner write.
      if (instructorTouched && preInstructorState) {
        void fireInstructorAutoSync(supabase, preInstructorState, refreshed || data);
      }

      return NextResponse.json({ block: refreshed || data });
    }

    if (instructorTouched && preInstructorState) {
      void fireInstructorAutoSync(supabase, preInstructorState, data);
    }

    return NextResponse.json({ block: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const detail = (err as { details?: string; hint?: string; code?: string })?.details || '';
    const code = (err as { code?: string })?.code || '';
    console.error('Update schedule block error:', { blockId, message, detail, code, err });
    return NextResponse.json({
      error: message,
      detail: detail || undefined,
      code: code || undefined,
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
