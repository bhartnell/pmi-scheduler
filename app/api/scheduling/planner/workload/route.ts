import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const instructorId = searchParams.get('instructor_id');

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('pmi_instructor_workload')
      .select(`
        *,
        instructor:lab_users!pmi_instructor_workload_instructor_id_fkey(id, name, email)
      `)
      .eq('semester_id', semesterId)
      .order('week_number')
      .order('instructor_id');

    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ workload: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Get workload error:', err);
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
    const { semester_id } = body;

    if (!semester_id) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get semester date range
    const { data: semester, error: semError } = await supabase
      .from('pmi_semesters')
      .select('start_date, end_date')
      .eq('id', semester_id)
      .single();

    if (semError || !semester) {
      return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
    }

    // Get all blocks with instructors for this semester
    const { data: schedules } = await supabase
      .from('pmi_program_schedules')
      .select('id')
      .eq('semester_id', semester_id)
      .eq('is_active', true);

    const scheduleIds = (schedules || []).map(s => s.id);

    if (scheduleIds.length === 0) {
      return NextResponse.json({ message: 'No active program schedules', recalculated: 0 });
    }

    const { data: blocks } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, start_time, end_time, day_of_week,
        program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
          id,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            program:programs(name)
          )
        ),
        instructors:pmi_block_instructors(instructor_id)
      `)
      .in('program_schedule_id', scheduleIds);

    // Calculate weeks
    const start = new Date(semester.start_date + 'T00:00:00');
    const end = new Date(semester.end_date + 'T00:00:00');
    const totalWeeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Build workload map: instructor_id → week_number → { hours, blocks, programs }
    const workloadMap = new Map<string, Map<number, { hours: number; blocks: number; programs: Set<string> }>>();

    for (const block of (blocks || [])) {
      const [sh, sm] = block.start_time.split(':').map(Number);
      const [eh, em] = block.end_time.split(':').map(Number);
      const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ps = block.program_schedule as any;
      const programName: string = ps?.cohort?.program?.name || 'Unknown';

      for (const assignment of (block.instructors || [])) {
        const instrId = assignment.instructor_id;
        if (!workloadMap.has(instrId)) workloadMap.set(instrId, new Map());
        const instrMap = workloadMap.get(instrId)!;

        // This block applies to every week (recurring)
        for (let w = 1; w <= totalWeeks; w++) {
          if (!instrMap.has(w)) instrMap.set(w, { hours: 0, blocks: 0, programs: new Set() });
          const entry = instrMap.get(w)!;
          entry.hours += hours;
          entry.blocks += 1;
          entry.programs.add(programName);
        }
      }
    }

    // Upsert workload records
    const upserts: Array<Record<string, unknown>> = [];
    for (const [instrId, weekMap] of workloadMap) {
      for (const [week, data] of weekMap) {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

        upserts.push({
          semester_id,
          instructor_id: instrId,
          week_number: week,
          week_start_date: weekStart.toISOString().split('T')[0],
          total_hours: Math.round(data.hours * 100) / 100,
          block_count: data.blocks,
          programs: Array.from(data.programs),
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('pmi_instructor_workload')
        .upsert(upserts, { onConflict: 'semester_id,instructor_id,week_number' });

      if (upsertError) throw upsertError;
    }

    return NextResponse.json({ message: 'Workload recalculated', recalculated: upserts.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Recalculate workload error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
