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
        linked_lab_day_id,
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

  // Track linked lab days for dedup
  const linkedLabDayHours = new Map<string, number>(); // labDayId → block hours

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

    // Track linked lab days for dedup
    if (b.linked_lab_day_id) {
      const existing = linkedLabDayHours.get(b.linked_lab_day_id) || 0;
      if (hours > existing) linkedLabDayHours.set(b.linked_lab_day_id, hours);
    }
  }

  // Lab hours for this week
  try {
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date, start_time, end_time')
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

        // Build lookup maps
        const labDayMap = new Map<string, { date: string; start_time: string | null; end_time: string | null }>();
        for (const ld of labDays) labDayMap.set(ld.id, { date: ld.date, start_time: ld.start_time, end_time: ld.end_time });

        // Accumulate station hours per lab_day
        const labDayStationHours = new Map<string, number>();
        const assignedLabDayIds = new Set<string>();

        for (const a of (assignments || [])) {
          const station = stations.find(s => s.id === a.station_id);
          if (!station) continue;
          assignedLabDayIds.add(station.lab_day_id);
          const rotMinutes = station.rotation_minutes || 30;
          const numRotations = station.num_rotations || 1;
          const sHours = (rotMinutes * numRotations) / 60;
          labDayStationHours.set(station.lab_day_id, (labDayStationHours.get(station.lab_day_id) || 0) + sHours);
        }

        // Create one entry per lab_day
        for (const labDayId of assignedLabDayIds) {
          const ld = labDayMap.get(labDayId);
          if (!ld) continue;

          let labHours: number;
          let labStart = '';
          let labEnd = '';

          if (ld.start_time && ld.end_time) {
            const [lsh, lsm] = ld.start_time.split(':').map(Number);
            const [leh, lem] = ld.end_time.split(':').map(Number);
            labHours = ((leh * 60 + lem) - (lsh * 60 + lsm)) / 60;
            labStart = ld.start_time;
            labEnd = ld.end_time;
          } else {
            labHours = labDayStationHours.get(labDayId) || 2.5;
          }

          // Dedup with linked schedule blocks
          const linkedBlockHours = linkedLabDayHours.get(labDayId);
          if (linkedBlockHours !== undefined) {
            if (labHours <= linkedBlockHours) continue;
            labHours = labHours - linkedBlockHours;
          }

          details.push({
            title: 'Lab Day',
            start_time: labStart,
            end_time: labEnd,
            hours: Math.round(labHours * 100) / 100,
            day_of_week: null,
            date: ld.date,
            room: null,
            source: 'lab',
          });
        }
      }
    }
  } catch { /* lab tables may not exist */ }

  // LVFR hours for this week
  try {
    // First: plan placements with actual times
    const { data: lvfrPlacements } = await supabase
      .from('lvfr_aemt_plan_placements')
      .select('instructor_id, date, start_time, end_time, custom_title')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .eq('instructor_id', instructorId);

    const lvfrPlacementDates = new Set<string>();

    for (const lp of (lvfrPlacements || [])) {
      if (!lp.date) continue;
      const [lsh, lsm] = lp.start_time.split(':').map(Number);
      const [leh, lem] = lp.end_time.split(':').map(Number);
      const hours = Math.round(((leh * 60 + lem) - (lsh * 60 + lsm)) / 60 * 100) / 100;
      if (hours <= 0) continue;

      lvfrPlacementDates.add(lp.date);

      details.push({
        title: lp.custom_title || 'LVFR',
        start_time: lp.start_time,
        end_time: lp.end_time,
        hours,
        day_of_week: null,
        date: lp.date,
        room: null,
        source: 'lvfr',
      });
    }

    // Fallback: instructor assignments for dates not covered by placements
    const { data: lvfrAssignments } = await supabase
      .from('lvfr_aemt_instructor_assignments')
      .select('date, primary_instructor_id, secondary_instructor_id, additional_instructors')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    const LVFR_HOURS_PER_DAY = 8;

    for (const la of (lvfrAssignments || [])) {
      const instrIds: string[] = [];
      if (la.primary_instructor_id) instrIds.push(la.primary_instructor_id);
      if (la.secondary_instructor_id) instrIds.push(la.secondary_instructor_id);
      if (la.additional_instructors && Array.isArray(la.additional_instructors)) {
        instrIds.push(...la.additional_instructors);
      }
      if (!instrIds.includes(instructorId)) continue;
      if (lvfrPlacementDates.has(la.date)) continue;

      details.push({
        title: 'LVFR Assignment',
        start_time: '',
        end_time: '',
        hours: LVFR_HOURS_PER_DAY,
        day_of_week: null,
        date: la.date,
        room: null,
        source: 'lvfr',
      });
    }
  } catch { /* LVFR tables may not exist */ }

  // Sort by date then start_time
  details.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  const totalHours = Math.round(details.reduce((sum, d) => sum + d.hours, 0) * 100) / 100;
  const classHours = Math.round(details.filter(d => d.source === 'planner').reduce((s, d) => s + d.hours, 0) * 100) / 100;
  const labHours = Math.round(details.filter(d => d.source === 'lab').reduce((s, d) => s + d.hours, 0) * 100) / 100;
  const lvfrHours = Math.round(details.filter(d => d.source === 'lvfr').reduce((s, d) => s + d.hours, 0) * 100) / 100;

  return NextResponse.json({ details, totalHours, classHours, labHours, lvfrHours, weekNumber });
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
        linked_lab_day_id,
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

    // Track linked lab days from schedule blocks for deduplication
    // Key: "instrId|labDayId" → hours from the schedule block
    const linkedLabDayBlockHours = new Map<string, number>();

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

        // Track linked lab days for dedup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linkedLabDayId = (block as any).linked_lab_day_id;
        if (linkedLabDayId) {
          const dedupKey = `${instrId}|${linkedLabDayId}`;
          const existing = linkedLabDayBlockHours.get(dedupKey) || 0;
          if (hours > existing) linkedLabDayBlockHours.set(dedupKey, hours);
        }
      }
    }

    // ── Lab station hours ──
    const { data: labDays } = await supabase
      .from('lab_days')
      .select('id, date, start_time, end_time')
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

        // Build lab day lookup maps
        const labDayDateMap = new Map<string, string>();
        const labDayTimeMap = new Map<string, { start_time: string | null; end_time: string | null }>();
        for (const ld of labDays) {
          labDayDateMap.set(ld.id, ld.date);
          labDayTimeMap.set(ld.id, { start_time: ld.start_time, end_time: ld.end_time });
        }

        // Track hours per instructor per lab_day to dedup across multiple stations
        const instrLabDayHours = new Map<string, number>();

        for (const sa of (stationAssignments || [])) {
          if (!sa.user_id) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const station = sa.station as any;
          if (!station?.lab_day_id) continue;

          const labDate = labDayDateMap.get(station.lab_day_id);
          if (!labDate) continue;

          const weekNum = calcWeekNum(labDate, start);
          if (weekNum < 1 || weekNum > totalWeeks) continue;

          // Calculate station hours from rotation data
          const rotMinutes = station.rotation_minutes || 30;
          const numRotations = station.num_rotations || 1;
          const stationHours = (rotMinutes * numRotations) / 60;

          // Accumulate per instructor per lab day
          const ldKey = `${sa.user_id}|${station.lab_day_id}`;
          instrLabDayHours.set(ldKey, (instrLabDayHours.get(ldKey) || 0) + stationHours);
        }

        // Now create entries per instructor per lab_day (one entry per lab day, not per station)
        for (const [ldKey, stationTotalHours] of instrLabDayHours) {
          const [instrId, labDayId] = ldKey.split('|');
          const labDate = labDayDateMap.get(labDayId);
          if (!labDate) continue;

          const weekNum = calcWeekNum(labDate, start);
          if (weekNum < 1 || weekNum > totalWeeks) continue;

          // Use lab_day start_time/end_time if available, else station rotation hours, else default 2.5h
          const times = labDayTimeMap.get(labDayId);
          let labHours: number;
          let labStartTime = '';
          let labEndTime = '';

          if (times?.start_time && times?.end_time) {
            const [sh, sm] = times.start_time.split(':').map(Number);
            const [eh, em] = times.end_time.split(':').map(Number);
            labHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
            labStartTime = times.start_time;
            labEndTime = times.end_time;
          } else if (stationTotalHours > 0) {
            labHours = stationTotalHours;
          } else {
            labHours = 2.5; // default
          }

          // Dedup with linked schedule blocks: if this lab day is linked from a block,
          // count only once using the longer duration
          const dedupKey = `${instrId}|${labDayId}`;
          const linkedBlockHours = linkedLabDayBlockHours.get(dedupKey);
          if (linkedBlockHours !== undefined) {
            // Block already counted these hours as class time.
            // If lab hours are longer, add only the difference as lab hours.
            // If block hours are longer or equal, skip the lab entry entirely.
            if (labHours <= linkedBlockHours) continue;
            labHours = labHours - linkedBlockHours;
          }

          const entry = getOrCreateWeek(workloadMap, instrId, weekNum);

          const slotKey = `lab|${labDate}|${labDayId}`;
          if (entry.timeSlots.has(slotKey)) continue;
          entry.timeSlots.add(slotKey);

          entry.hours += labHours;
          entry.labHours += labHours;
          entry.blocks += 1;
          entry.programs.add('Lab');
          entry.details.push({
            title: 'Lab Day',
            start_time: labStartTime,
            end_time: labEndTime,
            hours: Math.round(labHours * 100) / 100,
            day_of_week: null,
            date: labDate,
            source: 'lab',
          });
        }
      }
    }

    // ── LVFR hours ──
    // First try lvfr_aemt_plan_placements (has actual start/end times per placement)
    try {
      const { data: lvfrPlacements } = await supabase
        .from('lvfr_aemt_plan_placements')
        .select('instructor_id, date, start_time, end_time, custom_title')
        .gte('date', semester.start_date)
        .lte('date', semester.end_date)
        .not('instructor_id', 'is', null);

      // Track which instructor+date combos we've handled via placements
      const lvfrPlacementDates = new Set<string>();

      for (const lp of (lvfrPlacements || [])) {
        if (!lp.instructor_id || !lp.date) continue;

        const weekNum = calcWeekNum(lp.date, start);
        if (weekNum < 1 || weekNum > totalWeeks) continue;

        const [sh, sm] = lp.start_time.split(':').map(Number);
        const [eh, em] = lp.end_time.split(':').map(Number);
        const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        if (hours <= 0) continue;

        const entry = getOrCreateWeek(workloadMap, lp.instructor_id, weekNum);

        const slotKey = `lvfr|${lp.date}|${lp.start_time}|${lp.end_time}`;
        if (entry.timeSlots.has(slotKey)) continue;
        entry.timeSlots.add(slotKey);

        entry.hours += hours;
        entry.lvfrHours += hours;
        entry.blocks += 1;
        entry.programs.add('LVFR');
        entry.details.push({
          title: lp.custom_title || 'LVFR',
          start_time: lp.start_time,
          end_time: lp.end_time,
          hours: Math.round(hours * 100) / 100,
          day_of_week: null,
          date: lp.date,
          source: 'lvfr',
        });

        lvfrPlacementDates.add(`${lp.instructor_id}|${lp.date}`);
      }

      // Also query lvfr_aemt_instructor_assignments for dates NOT covered by placements
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
          // Skip if already covered by plan placements
          if (lvfrPlacementDates.has(`${instrId}|${la.date}`)) continue;

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
      // LVFR tables may not exist — skip
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
