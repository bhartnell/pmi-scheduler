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
 * Fire-and-forget calendar sync after a planner block CREATE. Mirrors
 * fireInstructorAutoSync in blocks/[id]/route.ts (same fire-and-forget
 * style, same error handling) but as a pure "sync" — a brand-new block
 * has no OLD instructor state, so this is applyInstructorDiff with an
 * empty oldEmails set. Never throws — calendar sync is best-effort and
 * must never block the API response.
 */
async function fireCreateAutoSync(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  block: { id: string; recurring_group_id: string | null; instructor_id: string | null; additional_instructor_id: string | null },
  instructorIds: string[]
): Promise<void> {
  try {
    const allIds = Array.from(
      new Set([block.instructor_id, block.additional_instructor_id, ...instructorIds].filter(Boolean) as string[])
    );
    if (allIds.length === 0) return;

    const { data: users } = await supabase
      .from('lab_users')
      .select('id, email')
      .in('id', allIds);
    const newEmails = new Set<string>();
    for (const u of users ?? []) newEmails.add((u.email as string).toLowerCase());
    if (newEmails.size === 0) return;

    const diff: InstructorDiff = {
      recurringGroupId: block.recurring_group_id,
      blockIdForOneOff: block.recurring_group_id ? null : block.id,
      oldEmails: new Set(),
      newEmails,
    };

    const results = await applyInstructorDiff(diff);
    for (const r of results) {
      if (r.result.status === 'failed') {
        console.warn(`[planner-block POST] auto-sync ${r.action} failed for ${r.email}:`, 'error' in r.result ? r.result.error : '');
      } else {
        console.log(`[planner-block POST] auto-sync ${r.action} ${r.result.status} for ${r.email}`);
      }
    }
  } catch (err) {
    console.error('[planner-block POST] fireCreateAutoSync error:', err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const roomId = searchParams.get('room_id');
    const programScheduleId = searchParams.get('program_schedule_id');
    const dateFrom = searchParams.get('date_from');  // YYYY-MM-DD
    const dateTo = searchParams.get('date_to');      // YYYY-MM-DD
    // count_only=true returns just { count } for the whole semester —
    // used by the planner toolbar to show a draft-count badge on the
    // "Publish drafts" button without paying for the full row payload.
    const countOnly = searchParams.get('count_only') === 'true';
    const status = searchParams.get('status'); // optional 'draft'|'published'|'cancelled'

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    if (countOnly) {
      let countQ = supabase
        .from('pmi_schedule_blocks')
        .select('id', { count: 'exact', head: true })
        .eq('semester_id', semesterId);
      if (status) countQ = countQ.eq('status', status);
      if (programScheduleId) countQ = countQ.eq('program_schedule_id', programScheduleId);
      const { count, error: countErr } = await countQ;
      if (countErr) throw countErr;
      return NextResponse.json({ count: count ?? 0 });
    }

    let query = supabase
      .from('pmi_schedule_blocks')
      .select(BLOCK_SELECT)
      .eq('semester_id', semesterId)
      .order('date', { ascending: true, nullsFirst: false })
      .order('start_time');

    if (status) {
      query = query.eq('status', status);
    }

    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    if (programScheduleId) {
      query = query.eq('program_schedule_id', programScheduleId);
    }

    // Date range filtering for calendar view
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ blocks: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List schedule blocks error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      program_schedule_id, semester_id, room_id, day_of_week, start_time, end_time,
      block_type, title, course_name, content_notes, color,
      is_recurring, specific_date, sort_order, date, week_number, recurring_group_id,
      instructor_ids,
      // Direct-FK columns (Scheduling Overhaul follow-up).
      instructor_id, additional_instructor_id,
      // Year-anchor escape hatch — caller can pin a specific
      // semester even when the block date falls in a different one.
      force_semester_override,
    } = body;

    if (!semester_id || !start_time || !end_time) {
      return NextResponse.json({
        error: 'semester_id, start_time, and end_time are required'
      }, { status: 400 });
    }

    // Derive day_of_week from date if not provided
    let dayNum = typeof day_of_week === 'string' ? parseInt(day_of_week, 10) : day_of_week;
    if ((dayNum === undefined || isNaN(dayNum)) && date) {
      dayNum = new Date(date + 'T00:00:00').getDay();
    }

    const supabase = getSupabaseAdmin();

    // Year-anchor: the block's semester_id is now derived from its
    // date by default (with a cohort-override tier and an explicit
    // force_semester_override escape hatch). Without this, a block
    // dated May 15 created from a planner view loaded against
    // Spring 2026 would silently land in Spring 2026 even though
    // its date belongs to Summer 2026 — the original 285-block bug.
    const cohortIdForResolve = await cohortIdForProgramSchedule(
      supabase,
      program_schedule_id
    );
    const resolvedSemesterId = await assignSemesterId(supabase, {
      date,
      clientSemesterId: semester_id,
      cohortId: cohortIdForResolve,
      forceOverride: !!force_semester_override,
    });

    const { data, error } = await supabase
      .from('pmi_schedule_blocks')
      .insert({
        program_schedule_id: program_schedule_id || null,
        semester_id: resolvedSemesterId,
        room_id: room_id || null,
        day_of_week: dayNum ?? null,
        start_time,
        end_time,
        block_type: block_type || 'other',
        title: title || null,
        course_name: course_name || null,
        content_notes: content_notes || null,
        color: color || null,
        is_recurring: is_recurring ?? false,
        specific_date: specific_date ?? null,
        date: date || null,
        week_number: week_number ?? null,
        recurring_group_id: recurring_group_id || null,
        sort_order: sort_order ?? 0,
        instructor_id: instructor_id || null,
        additional_instructor_id: additional_instructor_id || null,
      })
      .select(BLOCK_SELECT)
      .single();

    if (error) throw error;

    // Assign instructors if provided
    const newInstructorIds: string[] = Array.isArray(instructor_ids) ? instructor_ids : [];
    if (newInstructorIds.length > 0 && data?.id) {
      const assignments = newInstructorIds.map(instId => ({
        schedule_block_id: data.id,
        instructor_id: instId,
        role: 'primary',
      }));
      await supabase.from('pmi_block_instructors').insert(assignments);

      // Re-fetch to include instructors in the response
      const { data: refreshed } = await supabase
        .from('pmi_schedule_blocks')
        .select(BLOCK_SELECT)
        .eq('id', data.id)
        .single();

      // Calendar auto-sync: new block + instructor assignments, mirrors
      // the PUT hook's fire-and-forget style so the API response returns
      // immediately (Google sync failures are logged, never fatal).
      void fireCreateAutoSync(
        supabase,
        {
          id: data.id,
          recurring_group_id: data.recurring_group_id ?? null,
          instructor_id: data.instructor_id ?? null,
          additional_instructor_id: data.additional_instructor_id ?? null,
        },
        newInstructorIds
      );

      return NextResponse.json({ block: refreshed || data });
    }

    // Calendar auto-sync for the direct-FK instructor_id/additional_instructor_id
    // case (no instructor_ids join-table assignments on this create).
    void fireCreateAutoSync(
      supabase,
      {
        id: data.id,
        recurring_group_id: data.recurring_group_id ?? null,
        instructor_id: data.instructor_id ?? null,
        additional_instructor_id: data.additional_instructor_id ?? null,
      },
      []
    );

    return NextResponse.json({ block: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const detail = (err as { details?: string; hint?: string; code?: string })?.details || '';
    const code = (err as { code?: string })?.code || '';
    console.error('Create schedule block error:', { message, detail, code, err });
    return NextResponse.json({
      error: message,
      detail: detail || undefined,
      code: code || undefined,
    }, { status: 500 });
  }
}
