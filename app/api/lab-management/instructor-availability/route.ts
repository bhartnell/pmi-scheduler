import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { isRtOnlyInstructor } from '@/lib/rt-only-instructors';

/**
 * GET /api/lab-management/instructor-availability
 *
 * Per the Availability-Aware Lab Planning spec, returns every
 * active instructor classified into one of four display groups:
 *
 *   "available"        — green dot. Full-time instructors are
 *                        available BY DEFAULT for the requested
 *                        [date, start_time, end_time] window (the
 *                        CALLING lab day's actual scheduled time —
 *                        see callers) and need no explicit submission;
 *                        part-time instructors need explicit
 *                        availability covering the slot. Either way,
 *                        no scheduling conflicts.
 *   "volunteer"        — blue dot. Signed up for THIS lab_day via
 *                        volunteer_events / volunteer_event_signups
 *                        (independent of explicit availability).
 *   "conflict"         — amber dot. May or may not have submitted
 *                        availability, but has a class block,
 *                        manual hour log, LVFR, shift, or other-
 *                        lab-day overlap that OVERLAPS the requested
 *                        [start_time, end_time] window — a same-day
 *                        class/event outside that window is NOT a
 *                        conflict (real time-range intersection, not
 *                        "has anything at all that day").
 *   "no_availability"  — gray dot. Part-time instructor, active, but
 *                        no availability record submitted for the
 *                        slot.
 *
 * IMPORTANT: callers must pass the LAB's actual start_time/end_time,
 * not a fixed all-day placeholder — passing an artificially wide
 * window (e.g. 08:00-17:00 for every lab regardless of its real time)
 * causes false conflicts: a class that doesn't overlap the real lab
 * time gets flagged anyway because it overlaps the wider placeholder
 * window. See app/labs/schedule/[id]/page.tsx and
 * stations/new/page.tsx for the current callers.
 *
 * Sources checked, in order:
 *   1. instructor_availability (explicit submissions, must cover
 *      slot fully — start_time <= slot.start AND end_time >= slot.end)
 *   1b. instructor_unavailability / recurring_unavailability_templates
 *      (explicit unavailability blocks — the override that beats the
 *      full-timer "available by default" rule; see below)
 *   2. pmi_block_instructors → pmi_schedule_blocks (class teaching)
 *   3. lab_stations on the same date (other lab_day = conflict;
 *      same lab_day = same_day_stations badge, not a conflict)
 *   4. lvfr_aemt_instructor_assignments (LVFR Academy)
 *   5. shift_signups (open shifts)
 *   6. manual_hour_logs (Gannon EMS 121, LVFR AEMT manual hours)
 *   7. volunteer_events / volunteer_event_signups (volunteer flag)
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

    // 1. Get all active instructors, excluding RT/ACLS-help-only staff — they
    // hold instructor rows for ACLS duty but aren't paramedic-program
    // instructors and shouldn't appear on this list (records kept for ACLS).
    const { data: rawInstructors } = await supabase
      .from('lab_users')
      .select('id, name, email, is_part_time')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin'])
      .eq('is_active', true)
      .order('name');
    const allInstructors = rawInstructors?.filter((i) => !isRtOnlyInstructor(i.email));

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

    // 1b. Explicit unavailability — the override that BEATS the
    // full-timer "available by default" rule (0a only adds positive
    // signal; full-timers don't submit availability rows at all, so
    // there was previously no way to mark one unavailable — deleting
    // instructor_availability rows does nothing, since full-timers
    // never depended on them). Two sources, both additive/dormant
    // until something writes to them (Task Handoff Queue, Josh
    // Lomonaco + [AVAILABILITY SYSTEM], Ben GO 2026-08-07):
    //   - instructor_unavailability: specific date/range blocks.
    //   - recurring_unavailability_templates: weekly/biweekly patterns.
    //     Open-ended ones (end_date IS NULL) are read directly here
    //     rather than relying on expansion, since there's no bound to
    //     expand to (see /api/scheduling/recurring-unavailability).
    try {
      const { data: unavailBlocks } = await supabase
        .from('instructor_unavailability')
        .select('instructor_id, start_date, end_date, start_time, end_time, is_all_day, reason')
        .lte('start_date', date)
        .gte('end_date', date);
      for (const block of unavailBlocks ?? []) {
        const entry = instructorMap.get(block.instructor_id);
        if (!entry) continue;
        if (!block.is_all_day && block.start_time && block.end_time
          && !timesOverlap(block.start_time, block.end_time, startTime, endTime)) {
          continue;
        }
        entry.available = false;
        entry.conflicts.push({
          source: 'unavailable',
          title: block.reason || 'Marked unavailable',
          start_time: block.is_all_day ? startTime : (block.start_time || startTime),
          end_time: block.is_all_day ? endTime : (block.end_time || endTime),
        });
      }
    } catch {
      // instructor_unavailability table absent — skip silently.
    }

    try {
      const { data: recurringUnavail } = await supabase
        .from('recurring_unavailability_templates')
        .select('instructor_id, weekdays, start_date, end_date, start_time, end_time, is_all_day, frequency, reason')
        .eq('is_active', true)
        .lte('start_date', date)
        .or(`end_date.is.null,end_date.gte.${date}`);
      for (const tpl of recurringUnavail ?? []) {
        const entry = instructorMap.get(tpl.instructor_id);
        if (!entry) continue;
        if (!Array.isArray(tpl.weekdays) || !tpl.weekdays.includes(dayOfWeek)) continue;
        if (tpl.frequency === 'biweekly') {
          const start = new Date(tpl.start_date + 'T12:00:00');
          const target = new Date(date + 'T12:00:00');
          const weekOf = Math.floor((target.getTime() - start.getTime()) / (7 * 86_400_000));
          if (weekOf % 2 !== 0) continue;
        }
        if (!tpl.is_all_day && tpl.start_time && tpl.end_time
          && !timesOverlap(tpl.start_time, tpl.end_time, startTime, endTime)) {
          continue;
        }
        entry.available = false;
        entry.conflicts.push({
          source: 'unavailable',
          title: tpl.reason || 'Recurring unavailability',
          start_time: tpl.is_all_day ? startTime : (tpl.start_time || startTime),
          end_time: tpl.is_all_day ? endTime : (tpl.end_time || endTime),
        });
      }
    } catch {
      // recurring_unavailability_templates table absent — skip silently.
    }

    // 2. Check pmi_schedule_blocks conflicts
    // Get blocks that are on this date (date-based) or on this day_of_week (recurring)
    //
    // block_type = 'lab' is excluded: those rows are the master-semester-
    // schedule's placeholder for "when this cohort's lab period happens"
    // (e.g. "S3 Pm Lab" 11:00-12:30), not a real separate class commitment
    // — the actual lab staffing lives in lab_days / lab_day_roles /
    // lab_stations, checked separately below. Without this filter, every
    // instructor on a lab's cohort-wide planner roster gets falsely
    // flagged CONFLICT against the very lab they're being scheduled for
    // (bug: 2026-08-31, 5 FT paramedic instructors all showed CONFLICT
    // because they were listed on the "Day 1 S2 Lab" schedule-block
    // placeholder for that same lab's own time slot).
    const { data: dateBlocks } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, title, course_name, start_time, end_time, block_type,
        instructors:pmi_block_instructors(instructor_id)
      `)
      .eq('date', date)
      .neq('block_type', 'lab');

    const { data: recurringBlocks } = await supabase
      .from('pmi_schedule_blocks')
      .select(`
        id, title, course_name, start_time, end_time, block_type,
        instructors:pmi_block_instructors(instructor_id)
      `)
      .eq('day_of_week', dayOfWeek)
      .eq('is_recurring', true)
      .is('date', null)
      .neq('block_type', 'lab');

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

    // 7. Volunteer signups: volunteer_events.linked_lab_day_id matching
    //    this lab_day, with the user listed in volunteer_event_signups.
    //    Flags the instructor as a volunteer for the blue-dot group.
    //    Volunteer doesn't override conflicts — conflict still wins so
    //    the operator sees the warning.
    //
    //    NOTE: this used to also treat any station_instructors row on
    //    THIS lab_day as a volunteer signal, but station_instructors is
    //    the generic "assigned to teach this station" table (written by
    //    the normal EditStationModal assignment flow via PATCH
    //    /api/lab-management/stations/[id] and POST
    //    /api/lab-management/station-instructors) — it has no column
    //    distinguishing a volunteer sign-up from a regular teaching
    //    assignment. Treating every row as "volunteer" mislabeled any
    //    instructor normally assigned to a station on their own lab day
    //    (blue "Volunteering" dot instead of green "Available"), even
    //    though no volunteer_events/volunteer_event_signups row existed
    //    for them. Removed 2026-07-10; volunteer_events is the one real
    //    source for this signal.
    if (labDayId) {
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
    // dot. Full-time instructors are available BY DEFAULT for the
    // requested lab window — they don't submit explicit availability
    // rows, so requiring has_explicit_availability for them
    // incorrectly demoted every conflict-free full-timer to
    // "no_availability" and hid them from the picker (bug: full-time
    // instructor with zero conflicts was excluded from the dropdown).
    // Only an actual conflict (handled above) should exclude a
    // full-timer now. Part-time instructors still must have
    // submitted explicit availability to count as "available". Falls
    // through to "no_availability" when nothing else applies.
    instructorMap.forEach(v => {
      if (v.conflicts.length > 0) {
        v.group = 'conflict';
      } else if (v.is_volunteer) {
        v.group = 'volunteer';
      } else if (!v.is_part_time) {
        v.group = 'available';
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
