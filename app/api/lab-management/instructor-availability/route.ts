import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/lab-management/instructor-availability
 *
 * Per the Availability-Aware Lab Planning spec, returns every
 * active instructor classified into one of four display groups:
 *
 *   "available"        — green dot. Has explicit availability
 *                        covering the slot AND no scheduling
 *                        conflicts.
 *   "volunteer"        — blue dot. Signed up for THIS lab_day via
 *                        station_instructors or volunteer_events
 *                        (independent of explicit availability).
 *   "conflict"         — amber dot. May or may not have submitted
 *                        availability, but has a class block,
 *                        manual hour log, LVFR, shift, or other-
 *                        lab-day overlap during the slot.
 *   "no_availability"  — gray dot. Active but no availability
 *                        record submitted for the slot.
 *
 * Sources checked, in order:
 *   1. instructor_availability (explicit submissions, must cover
 *      slot fully — start_time <= slot.start AND end_time >= slot.end)
 *   2. pmi_block_instructors → pmi_schedule_blocks (class teaching)
 *   3. lab_stations on the same date (other lab_day = conflict;
 *      same lab_day = same_day_stations badge, not a conflict)
 *   4. lvfr_aemt_instructor_assignments (LVFR Academy)
 *   5. shift_signups (open shifts)
 *   6. manual_hour_logs (Gannon EMS 121, LVFR AEMT manual hours)
 *   7. station_instructors / volunteer_events (volunteer flag)
 *
 * Tolerates absent tables — wraps optional sources in try/catch
 * so deployments that haven't applied a particular migration
 * still get a useful response.
 */
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
      .select('id, name, email, is_part_time')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin'])
      .eq('is_active', true)
      .order('name');

    if (!allInstructors || allInstructors.length === 0) {
      return NextResponse.json({ success: true, instructors: [] });
    }

    type Group = 'available' | 'volunteer' | 'conflict' | 'no_availability';
    const instructorMap = new Map<string, {
      id: string; name: string; email: string;
      is_part_time: boolean;
      available: boolean;
      group: Group;
      has_explicit_availability: boolean;
      is_volunteer: boolean;
      conflicts: { source: string; title: string; start_time: string; end_time: string }[];
      same_day_hours: number;
      same_day_stations: { station_number: number; station_type: string }[];
    }>();

    for (const instr of allInstructors) {
      instructorMap.set(instr.id, {
        id: instr.id,
        name: instr.name,
        email: instr.email,
        is_part_time: !!instr.is_part_time,
        available: true,
        group: 'no_availability',         // upgraded below as evidence comes in
        has_explicit_availability: false,
        is_volunteer: false,
        conflicts: [],
        same_day_hours: 0,
        same_day_stations: [],
      });
    }

    // 0a. Explicit availability rows that COVER the requested slot.
    //     Source-of-truth for the green dot: an instructor only
    //     gets "available" group when they've submitted (or had
    //     seeded) availability for this date that wraps the slot.
    try {
      const { data: availRows } = await supabase
        .from('instructor_availability')
        .select('instructor_id, start_time, end_time, is_all_day')
        .eq('date', date);
      for (const a of availRows ?? []) {
        const entry = instructorMap.get(a.instructor_id);
        if (!entry) continue;
        if (a.is_all_day) {
          entry.has_explicit_availability = true;
          continue;
        }
        // Slot must fall ENTIRELY inside the available window.
        if (a.start_time && a.end_time && a.start_time <= startTime && a.end_time >= endTime) {
          entry.has_explicit_availability = true;
        }
      }
    } catch {
      // instructor_availability table absent — skip silently.
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

    // 6. Manual hour logs (Gannon EMS 121 ad-hoc entries, LVFR
    //    AEMT manual hours). The schema only has duration_minutes
    //    + entry_type — no start/end time. Treat any entry on the
    //    target date as a same-day conflict; the tooltip surfaces
    //    the entry_type so coordinators can decide.
    try {
      const { data: manualLogs } = await supabase
        .from('manual_hour_logs')
        .select('user_id, duration_minutes, entry_type, notes')
        .eq('date', date);
      for (const log of manualLogs ?? []) {
        const entry = instructorMap.get(log.user_id);
        if (!entry) continue;
        entry.available = false;
        const hours = log.duration_minutes ? Math.round((log.duration_minutes / 60) * 10) / 10 : 0;
        entry.conflicts.push({
          source: 'manual_log',
          title: log.notes
            ? `${log.entry_type}: ${log.notes}`
            : `Manual ${log.entry_type} (${hours}h)`,
          start_time: startTime,
          end_time: endTime,
        });
      }
    } catch {
      // manual_hour_logs absent — skip silently.
    }

    // 7. Volunteer signups. Two signals to honour:
    //    a) station_instructors row keyed to a station belonging
    //       to THIS lab_day (caller passed lab_day_id).
    //    b) volunteer_events.linked_lab_day_id matching this lab_day
    //       with the user listed in volunteer_event_signups.
    //    Either signal flags the instructor as a volunteer for the
    //    blue-dot group. Volunteer doesn't override conflicts —
    //    conflict still wins so the operator sees the warning.
    if (labDayId) {
      try {
        const { data: thisLabStations } = await supabase
          .from('lab_stations')
          .select('id, station_instructors:station_instructors(user_id, user_email)')
          .eq('lab_day_id', labDayId);
        for (const s of thisLabStations ?? []) {
          for (const si of (s as { station_instructors?: Array<{ user_id?: string; user_email?: string }> }).station_instructors ?? []) {
            let entry = si.user_id ? instructorMap.get(si.user_id) : undefined;
            if (!entry && si.user_email) {
              const lower = si.user_email.toLowerCase();
              instructorMap.forEach(v => {
                if (!entry && v.email.toLowerCase() === lower) entry = v;
              });
            }
            if (entry) entry.is_volunteer = true;
          }
        }
      } catch {
        // table missing — skip
      }

      try {
        const { data: vEvents } = await supabase
          .from('volunteer_events')
          .select('id')
          .eq('linked_lab_day_id', labDayId);
        const vEventIds = (vEvents ?? []).map(v => v.id);
        if (vEventIds.length > 0) {
          const { data: signups } = await supabase
            .from('volunteer_event_signups')
            .select('user_id, user_email')
            .in('event_id', vEventIds);
          for (const su of signups ?? []) {
            let entry = su.user_id ? instructorMap.get(su.user_id) : undefined;
            if (!entry && su.user_email) {
              const lower = su.user_email.toLowerCase();
              instructorMap.forEach(v => {
                if (!entry && v.email.toLowerCase() === lower) entry = v;
              });
            }
            if (entry) entry.is_volunteer = true;
          }
        }
      } catch {
        // volunteer_events / volunteer_event_signups absent — skip
      }
    }

    // Group classification — runs after every signal has been
    // collected. Conflict trumps everything (operator must see the
    // warning); volunteer signal trumps explicit availability so a
    // volunteer who DIDN'T submit availability still gets the blue
    // dot. Falls through to "no_availability" when nothing else
    // applies.
    instructorMap.forEach(v => {
      if (v.conflicts.length > 0) {
        v.group = 'conflict';
      } else if (v.is_volunteer) {
        v.group = 'volunteer';
      } else if (v.has_explicit_availability) {
        v.group = 'available';
      } else {
        v.group = 'no_availability';
      }
    });

    // Sort by group order (available → volunteer → conflict →
    // no_availability) per spec, then by name within each group.
    const groupOrder: Record<Group, number> = {
      available: 0,
      volunteer: 1,
      conflict: 2,
      no_availability: 3,
    };
    const instructors = Array.from(instructorMap.values())
      .sort((a, b) => {
        const ga = groupOrder[a.group];
        const gb = groupOrder[b.group];
        if (ga !== gb) return ga - gb;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ success: true, instructors });
  } catch (error) {
    console.error('Error checking instructor availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to check availability' }, { status: 500 });
  }
}
