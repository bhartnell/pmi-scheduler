import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/scheduling/planner/blocks/check-existing
 * Checks if blocks already exist for a semester + program_schedule/cohort.
 * Used by Generate wizard to prevent duplicate generation.
 *
 * Query params:
 *   semester_id: string (required)
 *   program_schedule_id?: string
 *   program_type?: string
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const programScheduleId = searchParams.get('program_schedule_id');

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('pmi_schedule_blocks')
      .select('id, course_name, recurring_group_id, date')
      .eq('semester_id', semesterId);

    if (programScheduleId) {
      query = query.eq('program_schedule_id', programScheduleId);
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
