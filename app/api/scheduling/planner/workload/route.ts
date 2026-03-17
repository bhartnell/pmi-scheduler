import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ── Helpers ──

interface BlockDetail {
  title: string;
  start_time: string;
  end_time: string;
  hours: number;
  day_of_week: number | null;
  date: string | null;
  source: string; // 'planner' | 'lab' | 'lvfr'
}

interface WeekEntry {
  hours: number;
  classHours: number;
  labHours: number;
  lvfrHours: number;
  blocks: number;
  programs: Set<string>;
  details: BlockDetail[];
  // Dedup: track time slots to avoid counting the same slot twice
  // key = "date|start_time|end_time" or "day|start_time|end_time"
  timeSlots: Set<string>;
}

function calcWeekNum(dateStr: string, semStart: Date): number {
  const d = new Date(dateStr + 'T00:00:00');
  return Math.ceil((d.getTime() - semStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function getOrCreateWeek(
  workloadMap: Map<string, Map<number, WeekEntry>>,
  instrId: string,
  weekNum: number
): WeekEntry {
  if (!workloadMap.has(instrId)) workloadMap.set(instrId, new Map());
  const instrMap = workloadMap.get(instrId)!;
  if (!instrMap.has(weekNum)) {
    instrMap.set(weekNum, { hours: 0, classHours: 0, labHours: 0, lvfrHours: 0, blocks: 0, programs: new Set(), details: [], timeSlots: new Set() });
  }
  return instrMap.get(weekNum)!;
}

// ── GET: Fetch stored workload ──

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');
    const instructorId = searchParams.get('instructor_id');
    const weekNumber = searchParams.get('week_number');

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    // ── Detail mode: return raw blocks for one instructor + week ──
    if (instructorId && weekNumber) {
      return getWeekDetail(semesterId, instructorId, parseInt(weekNumber, 10));
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

// ── Detail: return individual blocks for one instructor + one week ──

async function getWeekDetail(semesterId: string, instructorId: string, weekNumber: number) {
  const supabase = getSupabaseAdmin();

  const { data: semester } = await supabase
    .from('pmi_semesters')
    .select('start_date, end_date')
    .eq('id', semesterId)
    .single();

  if (!semester) {
    return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
  }

  const semStart = new Date(semester.start_date + 'T00:00:00');

  // Calculate the date range for this week
  const weekStart = new Date(semStart);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // Get blocks for this instructor in this week
  const { data: instrBlocks } = await supabase
    .from('pmi_block_instructors')
    .select(`
      schedule_block_id,
      block:pmi_schedule_blocks!pmi_block_instructors_schedule_block_id_fkey(
        id, start_time, end_time, day_of_week, title, course_name, date, week_number,
        room:pmi_rooms(name)
      )
    `)
    .eq('instructor_id', instructorId);

  const details: Array<{
    title: string;
    start_time: string;
    end_time: string;
    hours: number;
    day_of_week: number | null;
    date: string | null;
    room: string | null;
    source: string;
  }> = [];

  const seenSlots = new Set<string>();

  for (const ib of (instrBlocks || [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = ib.block as any;
    if (!b) continue;

    // Derive week from date (don't trust stored week_number — it can be wrong)
    let blockWeek: number | null = null;
    if (b.date) {
      blockWeek = calcWeekNum(b.date, semStart);
    } else if (b.week_number) {
      blockWeek = b.week_number; // fallback only if no date
    }
    if (blockWeek !== weekNumber) continue;

    // Deduplicate overlapping time slots
    const slotKey = `${b.date || b.day_of_week}|${b.start_time}|${b.end_time}`;
    if (seenSlots.has(slotKey)) continue;
    seenSlots.add(slotKey);

    const [sh, sm] = b.start_time.split(':').map(Number);
    const [eh, em] = b.end_time.split(':').map(Number);
    const hours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 100) / 100;

    details.push({
      title: b.title || b.course_name || 'Untitled',
      start_time: b.start_time,
      end_time: b.end_time,
      hours,
      day_of_week: b.day_of_week,
      date: b.date,
      room: b.room?.name || null,
      source: 'planner',
    });
  }

  // Lab station hours for this week
  try {
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    if (labDays && labDays.length > 0) {
      const labDayIds = labDays.map(ld => ld.id);
      const { data: stations } = await supabase
        .from('lab_stations')
        .select('id, name, lab_day_id, rotation_minutes, num_rotations')
        .in('lab_day_id', labDayIds);

      if (stations && stations.length > 0) {
        const { data: assignments } = await supabase
          .from('station_instructors')
          .select('station_id')
          .eq('user_id', instructorId)
          .in('station_id', stations.map(s => s.id));

        const labDayDateMap = new Map<string, string>();
        for (const ld of labDays) labDayDateMap.set(ld.id, ld.date);

        for (const a of (assignments || [])) {
          const station = stations.find(s => s.id === a.station_id);
          if (!station) continue;
          const labDate = labDayDateMap.get(station.lab_day_id);
          const rotMinutes = station.rotation_minutes || 30;
          const numRotations = station.num_rotations || 1;
          const hours = Math.round((rotMinutes * numRotations) / 60 * 100) / 100;

          details.push({
            title: `Lab: ${station.name || 'Station'}`,
            start_time: '',
            end_time: '',
            hours,
            day_of_week: null,
            date: labDate || null,
            room: null,
            source: 'lab',
          });
        }
      }
    }
  } catch { /* lab tables may not exist */ }

  // Sort by date then start_time
  details.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  const totalHours = Math.round(details.reduce((sum, d) => sum + d.hours, 0) * 100) / 100;

  return NextResponse.json({ details, totalHours, weekNumber });
}

// ── POST: Recalculate workload ──

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

    // Calculate weeks — cap at 15 instruction weeks
    const start = new Date(semester.start_date + 'T00:00:00');
    const end = new Date(semester.end_date + 'T00:00:00');
    const rawWeeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const totalWeeks = Math.min(rawWeeks, 18); // hard ceiling

    // Build workload map: instructor_id → week_number → WeekEntry
    const workloadMap = new Map<string, Map<number, WeekEntry>>();

    for (const block of (blocks || [])) {
      const [sh, sm] = block.start_time.split(':').map(Number);
      const [eh, em] = block.end_time.split(':').map(Number);
      const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ps = block.program_schedule as any;
      const programName: string = ps?.cohort?.program?.name || block.title || block.course_name || 'Unlinked';

      // Derive week from date (don't trust stored week_number — it can be wrong)
      let weekNum: number | null = null;
      if (block.date) {
        weekNum = calcWeekNum(block.date, start);
      } else if (block.week_number) {
        weekNum = block.week_number; // fallback only if no date
      }
      // Skip blocks with no week info
      if (weekNum === null || weekNum < 1 || weekNum > totalWeeks) continue;

      for (const assignment of (block.instructors || [])) {
        const instrId = assignment.instructor_id;
        const entry = getOrCreateWeek(workloadMap, instrId, weekNum);

        // ── DEDUP: same instructor, same time slot = count only once ──
        // This prevents inflation when the same class block exists under
        // multiple program_schedules (cohorts) and the instructor is assigned
        // to each copy via pmi_block_instructors.
        const slotKey = `${block.date || block.day_of_week}|${block.start_time}|${block.end_time}`;
        if (entry.timeSlots.has(slotKey)) continue;
        entry.timeSlots.add(slotKey);

        entry.hours += hours;
        entry.classHours += hours;
        entry.blocks += 1;
        entry.programs.add(programName);
        entry.details.push({
          title: block.title || block.course_name || programName,
          start_time: block.start_time,
          end_time: block.end_time,
          hours: Math.round(hours * 100) / 100,
          day_of_week: block.day_of_week,
          date: block.date,
          source: 'planner',
        });
      }
    }

    // ── Lab station hours ──
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date')
      .gte('date', semester.start_date)
      .lte('date', semester.end_date);

    if (labDays && labDays.length > 0) {
      const labDayIds = labDays.map(ld => ld.id);

      const { data: labStations } = await supabase
        .from('lab_stations')
        .select('id')
        .in('lab_day_id', labDayIds);

      const stationIds = (labStations || []).map(s => s.id);

      if (stationIds.length > 0) {
        const { data: stationAssignments } = await supabase
          .from('station_instructors')
          .select(`
            user_id,
            station:lab_stations!station_instructors_station_id_fkey(
              id, name, rotation_minutes, num_rotations, lab_day_id
            )
          `)
          .in('station_id', stationIds);

        const labDayDateMap = new Map<string, string>();
        for (const ld of labDays) labDayDateMap.set(ld.id, ld.date);

        for (const sa of (stationAssignments || [])) {
          if (!sa.user_id) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const station = sa.station as any;
          if (!station?.lab_day_id) continue;

          const labDate = labDayDateMap.get(station.lab_day_id);
          if (!labDate) continue;

          const rotMinutes = station.rotation_minutes || 30;
          const numRotations = station.num_rotations || 1;
          const stationHours = (rotMinutes * numRotations) / 60;

          const weekNum = calcWeekNum(labDate, start);
          if (weekNum < 1 || weekNum > totalWeeks) continue;

          const entry = getOrCreateWeek(workloadMap, sa.user_id, weekNum);

          // Dedup lab stations too (same station on same date)
          const slotKey = `lab|${labDate}|${station.id}`;
          if (entry.timeSlots.has(slotKey)) continue;
          entry.timeSlots.add(slotKey);

          entry.hours += stationHours;
          entry.labHours += stationHours;
          entry.blocks += 1;
          entry.programs.add('Lab');
          entry.details.push({
            title: `Lab: ${station.name || 'Station'}`,
            start_time: '',
            end_time: '',
            hours: Math.round(stationHours * 100) / 100,
            day_of_week: null,
            date: labDate,
            source: 'lab',
          });
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

      const LVFR_HOURS_PER_DAY = 8;

      for (const la of (lvfrAssignments || [])) {
        const weekNum = calcWeekNum(la.date, start);
        if (weekNum < 1 || weekNum > totalWeeks) continue;

        const instructorIds: string[] = [];
        if (la.primary_instructor_id) instructorIds.push(la.primary_instructor_id);
        if (la.secondary_instructor_id) instructorIds.push(la.secondary_instructor_id);
        if (la.additional_instructors && Array.isArray(la.additional_instructors)) {
          instructorIds.push(...la.additional_instructors);
        }

        for (const instrId of instructorIds) {
          const entry = getOrCreateWeek(workloadMap, instrId, weekNum);

          const slotKey = `lvfr|${la.date}`;
          if (entry.timeSlots.has(slotKey)) continue;
          entry.timeSlots.add(slotKey);

          entry.hours += LVFR_HOURS_PER_DAY;
          entry.lvfrHours += LVFR_HOURS_PER_DAY;
          entry.blocks += 1;
          entry.programs.add('LVFR');
          entry.details.push({
            title: 'LVFR Assignment',
            start_time: '',
            end_time: '',
            hours: LVFR_HOURS_PER_DAY,
            day_of_week: null,
            date: la.date,
            source: 'lvfr',
          });
        }
      }
    } catch {
      // LVFR table may not exist — skip
    }

    // ── Clear old workload records for this semester before upserting ──
    await supabase
      .from('pmi_instructor_workload')
      .delete()
      .eq('semester_id', semester_id);

    // Upsert workload records (only weeks with actual data)
    const upserts: Array<Record<string, unknown>> = [];
    const debug: Array<{ instructor_id: string; week: number; hours: number; blocks: number; detail_count: number }> = [];

    for (const [instrId, weekMap] of workloadMap) {
      for (const [week, data] of weekMap) {
        if (data.hours <= 0) continue; // skip empty weeks

        const weekStartDate = new Date(start);
        weekStartDate.setDate(weekStartDate.getDate() + (week - 1) * 7);

        const totalHours = Math.round(data.hours * 100) / 100;

        upserts.push({
          semester_id,
          instructor_id: instrId,
          week_number: week,
          week_start_date: weekStartDate.toISOString().split('T')[0],
          total_hours: totalHours,
          class_hours: Math.round(data.classHours * 100) / 100,
          lab_hours: Math.round(data.labHours * 100) / 100,
          lvfr_hours: Math.round(data.lvfrHours * 100) / 100,
          block_count: data.blocks,
          programs: Array.from(data.programs),
          updated_at: new Date().toISOString(),
        });

        debug.push({
          instructor_id: instrId,
          week,
          hours: totalHours,
          blocks: data.blocks,
          detail_count: data.details.length,
        });
      }
    }

    if (upserts.length > 0) {
      // Batch in chunks of 500 to avoid payload limits
      for (let i = 0; i < upserts.length; i += 500) {
        const chunk = upserts.slice(i, i + 500);
        const { error: upsertError } = await supabase
          .from('pmi_instructor_workload')
          .upsert(chunk, { onConflict: 'semester_id,instructor_id,week_number' });
        if (upsertError) throw upsertError;
      }
    }

    return NextResponse.json({
      message: 'Workload recalculated',
      recalculated: upserts.length,
      totalBlocks: blocks?.length || 0,
      debug: debug.slice(0, 50), // first 50 entries for debugging
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Recalculate workload error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
