import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/scheduling/planner/blocks/check-existing
 * Checks if blocks already exist for a semester / program_schedule /
 * cohort. Used by the Generate wizard to prevent duplicate generation.
 *
 * Query params (at least one of semester_id OR cohort_id required):
 *   semester_id?: string         — filter by semester
 *   cohort_id?: string           — filter by cohort (any semester);
 *                                  resolves the cohort's program_schedules
 *                                  and counts blocks across them. The
 *                                  wizard uses this to surface "this
 *                                  cohort already has X blocks" before
 *                                  Generate is clicked.
 *   program_schedule_id?: string — pin the count to one program_schedule
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const programScheduleId = searchParams.get('program_schedule_id');
    const cohortId = searchParams.get('cohort_id');

    if (!semesterId && !cohortId && !programScheduleId) {
      return NextResponse.json(
        { error: 'one of semester_id, cohort_id, or program_schedule_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // If cohort_id was passed but program_schedule_id wasn't,
    // resolve every program_schedule that belongs to this cohort so
    // the count covers blocks across all of the cohort's semesters
    // (matches the user-facing "this cohort already has X blocks"
    // warning).
    let cohortProgramScheduleIds: string[] = [];
    if (cohortId && !programScheduleId) {
      const { data: psRows, error: psErr } = await supabase
        .from('pmi_program_schedules')
        .select('id')
        .eq('cohort_id', cohortId);
      if (psErr) throw psErr;
      cohortProgramScheduleIds = (psRows ?? []).map(r => r.id);
    }

    let query = supabase
      .from('pmi_schedule_blocks')
      .select('id, course_name, recurring_group_id, date');

    if (semesterId) query = query.eq('semester_id', semesterId);
    if (programScheduleId) {
      query = query.eq('program_schedule_id', programScheduleId);
    } else if (cohortProgramScheduleIds.length > 0) {
      query = query.in('program_schedule_id', cohortProgramScheduleIds);
    } else if (cohortId) {
      // cohort has zero program_schedules → can't possibly have blocks
      return NextResponse.json({
        has_existing: false,
        total_count: 0,
        courses: [],
      });
    }

    const { data: blocks, error } = await query;
    if (error) throw error;

    const blockList = blocks || [];
    const totalCount = blockList.length;

    if (totalCount === 0) {
      return NextResponse.json({
        has_existing: false,
        total_count: 0,
        courses: [],
      });
    }

    // Group by course_name to show what already exists
    const courseMap = new Map<string, { count: number; recurring_group_id: string | null }>();
    for (const b of blockList) {
      const name = b.course_name || 'Untitled';
      const existing = courseMap.get(name);
      if (existing) {
        existing.count++;
      } else {
        courseMap.set(name, { count: 1, recurring_group_id: b.recurring_group_id });
      }
    }

    const courses = Array.from(courseMap.entries()).map(([name, info]) => ({
      course_name: name,
      block_count: info.count,
      recurring_group_id: info.recurring_group_id,
    }));

    return NextResponse.json({
      has_existing: true,
      total_count: totalCount,
      courses,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Check existing blocks error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
