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

    // Get blocks by semester_id (catches both linked and unlinked blocks)
    const { data: blocks } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, start_time, end_time, day_of_week, title, course_name, date, week_number,
        program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
          id,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            program:programs(name)
          )
        ),
        instructors:pmi_block_instructors(instructor_id)
      `)
      .eq('semester_id', semester_id);

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
      const programName: string = ps?.cohort?.program?.name || block.title || block.course_name || 'Unlinked';

      for (const assignment of (block.instructors || [])) {
        const instrId = assignment.instructor_id;
        if (!workloadMap.has(instrId)) workloadMap.set(instrId, new Map());
        const instrMap = workloadMap.get(instrId)!;

        // Determine which week this block belongs to:
        // 1. Use week_number if set (recurring blocks are expanded per-week with week_number)
        // 2. Fall back to calculating from date
        // 3. Skip blocks with neither (shouldn't happen but safety check)
        let weekNum: number | null = null;

        if (block.week_number) {
          weekNum = block.week_number;
        } else if (block.date) {
          const blockDate = new Date(block.date + 'T00:00:00');
          weekNum = Math.ceil((blockDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        }
        // Note: blocks without week_number AND without date are skipped.
        // The old code treated these as "recurring across all weeks" which caused
        // massive inflation (18x) since recurring blocks are already expanded per-week.

        if (weekNum !== null && weekNum >= 1 && weekNum <= totalWeeks) {
          if (!instrMap.has(weekNum)) instrMap.set(weekNum, { hours: 0, blocks: 0, programs: new Set() });
          const entry = instrMap.get(weekNum)!;
          entry.hours += hours;
          entry.blocks += 1;
          entry.programs.add(programName);
        }
      }
    }

    // ── Lab station hours ──
    // Get all lab_days within the semester date range
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date')
      .gte('date', semester.start_date)
      .lte('date', semester.end_date);

    if (labDays && labDays.length > 0) {
      const labDayIds = labDays.map(ld => ld.id);

      // Get stations for these lab days
      const { data: labStations } = await supabase
        .from('lab_stations')
        .select('id')
        .in('lab_day_id', labDayIds);

      const stationIds = (labStations || []).map(s => s.id);

      if (stationIds.length > 0) {
        // Get station assignments with rotation duration
        const { data: stationAssignments } = await supabase
          .from('station_instructors')
          .select(`
            user_id,
            station:lab_stations!station_instructors_station_id_fkey(
              id, rotation_minutes, num_rotations, lab_day_id
            )
          `)
          .in('station_id', stationIds);

        // Build a map of lab_day_id -> date for week calculation
        const labDayDateMap = new Map<string, string>();
        for (const ld of labDays) labDayDateMap.set(ld.id, ld.date);

        for (const sa of (stationAssignments || [])) {
          if (!sa.user_id) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const station = sa.station as any;
          if (!station?.lab_day_id) continue;

          const labDate = labDayDateMap.get(station.lab_day_id);
          if (!labDate) continue;

          // Calculate hours for this station assignment
          const rotMinutes = station.rotation_minutes || 30;
          const numRotations = station.num_rotations || 1;
          const stationHours = (rotMinutes * numRotations) / 60;

          // Calculate which week this falls in
          const labDateObj = new Date(labDate + 'T00:00:00');
          const weekNum = Math.ceil((labDateObj.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (weekNum < 1 || weekNum > totalWeeks) continue;

          if (!workloadMap.has(sa.user_id)) workloadMap.set(sa.user_id, new Map());
          const instrMap = workloadMap.get(sa.user_id)!;
          if (!instrMap.has(weekNum)) instrMap.set(weekNum, { hours: 0, blocks: 0, programs: new Set() });
          const entry = instrMap.get(weekNum)!;
          entry.hours += stationHours;
          entry.blocks += 1;
          entry.programs.add('Lab');
        }
      }
    }

    // ── LVFR hours ──
    try {
      const { data: lvfrAssignments } = await supabase
        .from('lvfr_aemt_instructor_assignments')
        .select('date, primary_instructor_id, secondary_instructor_id, additional_instructors')
        .gte('date', semester.start_date)
        .lte('date', semester.end_date);

      const LVFR_HOURS_PER_DAY = 8; // Standard LVFR day

      for (const la of (lvfrAssignments || [])) {
        const assignDate = new Date(la.date + 'T00:00:00');
        const weekNum = Math.ceil((assignDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weekNum < 1 || weekNum > totalWeeks) continue;

        const instructorIds: string[] = [];
        if (la.primary_instructor_id) instructorIds.push(la.primary_instructor_id);
        if (la.secondary_instructor_id) instructorIds.push(la.secondary_instructor_id);
        if (la.additional_instructors && Array.isArray(la.additional_instructors)) {
          instructorIds.push(...la.additional_instructors);
        }

        for (const instrId of instructorIds) {
          if (!workloadMap.has(instrId)) workloadMap.set(instrId, new Map());
          const instrMap = workloadMap.get(instrId)!;
          if (!instrMap.has(weekNum)) instrMap.set(weekNum, { hours: 0, blocks: 0, programs: new Set() });
          const entry = instrMap.get(weekNum)!;
          entry.hours += LVFR_HOURS_PER_DAY;
          entry.blocks += 1;
          entry.programs.add('LVFR');
        }
      }
    } catch {
      // LVFR table may not exist — skip
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
