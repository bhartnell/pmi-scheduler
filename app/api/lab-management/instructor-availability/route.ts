import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    const labDayId = searchParams.get('lab_day_id');

    if (!date || !startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'date, start_time, and end_time are required' }, { status: 400 });
    }

    // Get day of week from date (0=Sun, 6=Sat)
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();

    // 1. Get all active instructors
    const { data: allInstructors } = await supabase
      .from('lab_users')
      .select('id, name, email')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin'])
      .eq('is_active', true)
      .order('name');

    if (!allInstructors || allInstructors.length === 0) {
      return NextResponse.json({ success: true, instructors: [] });
    }

    const instructorMap = new Map<string, {
      id: string; name: string; email: string;
      available: boolean;
      conflicts: { source: string; title: string; start_time: string; end_time: string }[];
      same_day_hours: number;
      same_day_stations: { station_number: number; station_type: string }[];
    }>();

    for (const instr of allInstructors) {
      instructorMap.set(instr.id, {
        id: instr.id,
        name: instr.name,
        email: instr.email,
        available: true,
        conflicts: [],
        same_day_hours: 0,
        same_day_stations: [],
      });
    }

    // Helper to check time overlap
    const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => {
      return aStart < bEnd && aEnd > bStart;
    };

    // 2. Check pmi_schedule_blocks conflicts
    // Get blocks that are on this date (date-based) or on this day_of_week (recurring)
    const { data: dateBlocks } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, title, course_name, start_time, end_time, block_type,
        instructors:pmi_block_instructors(instructor_id)
      `)
      .eq('date', date);

    const { data: recurringBlocks } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, title, course_name, start_time, end_time, block_type,
        instructors:pmi_block_instructors(instructor_id)
      `)
      .eq('day_of_week', dayOfWeek)
      .eq('is_recurring', true)
      .is('date', null);

    const allBlocks = [...(dateBlocks || []), ...(recurringBlocks || [])];
    for (const block of allBlocks) {
      if (!timesOverlap(block.start_time, block.end_time, startTime, endTime)) continue;
      for (const assignment of (block.instructors || [])) {
        const entry = instructorMap.get(assignment.instructor_id);
        if (entry) {
          entry.available = false;
          entry.conflicts.push({
            source: 'class',
            title: block.title || block.course_name || block.block_type || 'Class',
            start_time: block.start_time,
            end_time: block.end_time,
          });
        }
      }
    }

    // 3. Check lab station assignments (other lab days on same date)
    const { data: labDaysOnDate } = await supabase
      .from('lab_days')
      .select('id')
      .eq('date', date);

    if (labDaysOnDate && labDaysOnDate.length > 0) {
      const labDayIds = labDaysOnDate.map(ld => ld.id);

      const { data: stationsOnDate } = await supabase
        .from('lab_stations')
        .select(`
          id, station_number, station_type, lab_day_id,
          rotation_minutes,
          station_instructors:station_instructors(user_id, user_email)
        `)
        .in('lab_day_id', labDayIds);

      for (const station of (stationsOnDate || [])) {
        const isSameLabDay = station.lab_day_id === labDayId;
        const stationHours = (station.rotation_minutes || 120) / 60;

        for (const si of (station.station_instructors || [])) {
          // Find instructor by user_id or email
          let entry = si.user_id ? instructorMap.get(si.user_id) : undefined;
          if (!entry && si.user_email) {
            const emailLower = si.user_email.toLowerCase();
            instructorMap.forEach((v) => {
              if (!entry && v.email.toLowerCase() === emailLower) {
                entry = v;
              }
            });
          }

          if (entry) {
            if (isSameLabDay) {
              // Yellow dot: same lab day, different station
              entry.same_day_hours += stationHours;
              entry.same_day_stations.push({
                station_number: station.station_number,
                station_type: station.station_type,
              });
            } else {
              // Red: different lab day same date = conflict
              entry.available = false;
              entry.conflicts.push({
                source: 'lab',
                title: `Lab Station ${station.station_number} (${station.station_type})`,
                start_time: startTime,
                end_time: endTime,
              });
            }
          }
        }
      }
    }

    // 4. Check LVFR assignments
    try {
      const { data: lvfrAssignments } = await supabase
        .from('lvfr_aemt_instructor_assignments')
        .select('primary_instructor_id, secondary_instructor_id, additional_instructors')
        .eq('date', date);

      for (const la of (lvfrAssignments || [])) {
        const ids: string[] = [];
        if (la.primary_instructor_id) ids.push(la.primary_instructor_id);
        if (la.secondary_instructor_id) ids.push(la.secondary_instructor_id);
        if (la.additional_instructors && Array.isArray(la.additional_instructors)) {
          ids.push(...la.additional_instructors);
        }
        for (const id of ids) {
          const entry = instructorMap.get(id);
          if (entry) {
            entry.available = false;
            entry.conflicts.push({
              source: 'lvfr',
              title: 'LVFR Academy',
              start_time: '08:00',
              end_time: '17:00',
            });
          }
        }
      }
    } catch {
      // LVFR table may not exist — skip silently
    }

    // 5. Check shift signups
    try {
      const { data: confirmedSignups } = await supabase
        .from('shift_signups')
        .select(`
          instructor_id,
          signup_start_time,
          signup_end_time,
          shift:open_shifts!shift_signups_shift_id_fkey(date, start_time, end_time, title)
        `)
        .eq('status', 'confirmed');

      for (const signup of (confirmedSignups || [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shift = signup.shift as any;
        if (!shift || shift.date !== date) continue;

        const shiftStart = signup.signup_start_time || shift.start_time;
        const shiftEnd = signup.signup_end_time || shift.end_time;

        if (!shiftStart || !shiftEnd) continue;
        if (!timesOverlap(shiftStart, shiftEnd, startTime, endTime)) continue;

        const entry = instructorMap.get(signup.instructor_id);
        if (entry) {
          entry.available = false;
          entry.conflicts.push({
            source: 'shift',
            title: shift.title || 'Shift',
            start_time: shiftStart,
            end_time: shiftEnd,
          });
        }
      }
    } catch {
      // Shift tables may not exist — skip silently
    }

    // Sort: available first, then by name
    const instructors = Array.from(instructorMap.values())
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ success: true, instructors });
  } catch (error) {
    console.error('Error checking instructor availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to check availability' }, { status: 500 });
  }
}
