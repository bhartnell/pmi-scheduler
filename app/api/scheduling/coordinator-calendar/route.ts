import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/scheduling/coordinator-calendar
 *
 * Aggregated read for the coordinator calendar week/month view
 * (Scheduling Overhaul #2). Pulls everything that contributes to a
 * person's day from five sources and groups it by date so the client
 * can render one row per person per day without doing date math:
 *
 *   1. lab_days + lab_day_roles  → assigned instructors per lab
 *   2. open_shifts + shift_signups (status='confirmed') → confirmed shifts
 *   3. instructor_availability   → submitted windows + recurring slots
 *      (recurring templates materialise rows here with source_template_id)
 *   4. manual_hour_logs          → out-of-system class/prep hours
 *      (Gannon's class blocks, Matt's online classes, etc.)
 *
 * Permission: lead_instructor or above. Same gate as the rest of the
 * coordinator-facing scheduling tools.
 *
 * Query params:
 *   start_date   YYYY-MM-DD inclusive
 *   end_date     YYYY-MM-DD inclusive
 *
 * Response shape (kept flat so the client can iterate without joins):
 *   {
 *     success: true,
 *     start_date, end_date,
 *     people:    [{ id, name, email, role, is_part_time }],
 *     lab_days:  [{ id, date, start_time, end_time, cohort, priority_flag,
 *                   priority_reason, is_nremt_testing }],
 *     blocks:    [{ id, date, person_id, person_name, type, start_time,
 *                   end_time, hours, lab_day_id?, shift_id?, role?, notes? }]
 *   }
 *
 * `blocks` is the union of all activity types — the UI groups them by
 * date and person at render time. `lab_days` is included separately so
 * an unstaffed but priority-flagged day still shows the badge.
 */

type Block = {
  id: string;
  date: string;
  person_id: string;
  person_name: string;
  /** lab_assignment | shift | manual_hours | availability | recurring */
  type: 'lab_assignment' | 'shift' | 'manual_hours' | 'availability' | 'recurring';
  start_time: string | null;
  end_time: string | null;
  hours: number | null;
  lab_day_id?: string | null;
  shift_id?: string | null;
  role?: string | null;
  notes?: string | null;
  /** Free-form label the client can use as a tooltip ("EMS 111", "Phase 1 lab", etc.). */
  label?: string | null;
};

function durationHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (Number.isNaN(minutes) || minutes <= 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Lab-day duration with the spec's fallback rule. lab_days has no
 * `duration_hours` column — we derive from start_time/end_time, but
 * many older rows were created before the start/end fields became
 * required. Per the data-completeness clarification, missing times
 * count as a 4-hour day so those rows still pull weight in heat-map
 * and workload calculations rather than vanishing as zero.
 */
const LAB_DEFAULT_HOURS = 4;
function labDayHours(start: string | null, end: string | null): number {
  return durationHours(start, end) ?? LAB_DEFAULT_HOURS;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    // Role gate — coordinator view is lead_instructor+ per spec.
    const supabase = getSupabaseAdmin();
    const { data: callerRow } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email || '')
      .single();
    const callerRole = callerRow?.role ?? null;
    if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
      return NextResponse.json(
        { error: 'Forbidden — lead instructor or above required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // Pull all five sources in parallel. Each query is scoped to the
    // requested window so the payload stays bounded by date range
    // rather than total roster size.
    // ---------------------------------------------------------------
    const [labDaysRes, rolesRes, shiftsRes, availabilityRes, hoursRes] =
      await Promise.all([
        supabase
          .from('lab_days')
          .select(`
            id, date, start_time, end_time, title, cohort_id,
            priority_flag, priority_reason, is_nremt_testing,
            cohort:cohorts(
              id, cohort_number,
              program:programs(name, abbreviation)
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),

        // lab_day_roles → who's running each lab day. We join through
        // lab_day_id below; query independently so a missing role row
        // doesn't drop the lab_day from the priority badge surface.
        supabase
          .from('lab_day_roles')
          .select(`
            id, lab_day_id, role, notes,
            instructor:instructor_id(id, name, email),
            lab_day:lab_day_id(date, start_time, end_time, title)
          `),

        supabase
          .from('open_shifts')
          .select(`
            id, date, start_time, end_time, title, location, department,
            shift_signups!inner(
              id, status,
              instructor:instructor_id(id, name, email)
            )
          `)
          .eq('shift_signups.status', 'confirmed')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),

        supabase
          .from('instructor_availability')
          .select(`
            id, date, start_time, end_time, is_all_day, source_template_id,
            instructor:instructor_id(id, name, email)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),

        supabase
          .from('manual_hour_logs')
          .select(`
            id, date, duration_minutes, entry_type, notes,
            user:user_id(id, name, email)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
      ]);

    if (labDaysRes.error) throw labDaysRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (shiftsRes.error) throw shiftsRes.error;
    if (availabilityRes.error) throw availabilityRes.error;
    if (hoursRes.error) throw hoursRes.error;

    // Station-level instructor pull. Three sources contribute to a
    // single station: lab_stations.instructor_id (primary),
    // lab_stations.additional_instructor_id (secondary), and the
    // station_instructors many-to-many (volunteer examiners — Aly
    // Kent, Brittany Corn, etc.). We collapse all three downstream
    // into one block per (person, lab_day) so Schafer assigned to
    // BVM + NRB on an NREMT day shows as a single "Stations: BVM, NRB"
    // block rather than two separate chips. Runs as a second phase
    // (not in the parallel batch above) because we need the lab_day
    // IDs from the date-windowed lab_days query — lab_stations has
    // no date column of its own.
    const labDayIdsForStations = (labDaysRes.data ?? []).map((d: any) => d.id);
    const stationsRes = labDayIdsForStations.length
      ? await supabase
          .from('lab_stations')
          .select(`
            id, lab_day_id, station_number, custom_title, skill_name, station_type,
            instructor:instructor_id(id, name, email),
            additional_instructor:additional_instructor_id(id, name, email),
            station_instructors(
              id, user_id, is_primary,
              user:user_id(id, name, email)
            )
          `)
          .in('lab_day_id', labDayIdsForStations)
      : { data: [], error: null };
    if (stationsRes.error) throw stationsRes.error;

    // ---------------------------------------------------------------
    // Build the unified `blocks` array. Each source maps to a Block
    // with a discriminator on `type` — the client then groups
    // (date, person) and picks render styles per type.
    // ---------------------------------------------------------------
    type Person = { id: string; name: string; email: string };
    const peopleMap = new Map<string, Person & { role?: string }>();
    const remember = (p: Person | null | undefined) => {
      if (!p?.id) return;
      if (!peopleMap.has(p.id)) {
        peopleMap.set(p.id, { id: p.id, name: p.name || p.email, email: p.email });
      }
    };

    const blocks: Block[] = [];

    // 1. Lab assignments — only include rows whose lab_day falls in
    //    the requested window. Roles GET doesn't accept a date filter
    //    so we filter in JS against the embedded lab_day.date.
    //
    //    NOTE on cross-program coverage: neither the lab_days query
    //    above nor this lab_day_roles query filters by cohort_id or
    //    program_id, so LVFR AEMT (and any future ACLS / PALS / etc.
    //    program tracks) flow through the same payload as standard
    //    PMI cohorts. Jimi's LVFR AEMT shifts starting July 6 will
    //    appear alongside his PMI labs without further work.
    const labDayIdsInRange = new Set((labDaysRes.data ?? []).map((d: any) => d.id));
    // Build a quick lookup for lab_day metadata (date, times, title)
    // so the station loop below doesn't have to re-walk labDaysRes.
    const labDayById = new Map<string, any>();
    for (const d of labDaysRes.data ?? []) labDayById.set(d.id, d);

    // Dedupe key per (person, lab_day). lab_day_roles wins — when
    // someone is BOTH a lab_lead AND a station examiner on the same
    // day, we keep the role-level block (it has the better label) and
    // skip the station-level entry instead of stacking two chips.
    const labAssignmentSeen = new Set<string>();
    const seenKey = (personId: string, labDayId: string) => `${personId}|${labDayId}`;

    for (const r of rolesRes.data ?? []) {
      const ld = Array.isArray((r as any).lab_day) ? (r as any).lab_day[0] : (r as any).lab_day;
      const inst = Array.isArray((r as any).instructor) ? (r as any).instructor[0] : (r as any).instructor;
      if (!ld || !inst) continue;
      if (!labDayIdsInRange.has((r as any).lab_day_id)) continue;
      remember(inst);
      labAssignmentSeen.add(seenKey(inst.id, (r as any).lab_day_id));
      blocks.push({
        id: `role-${(r as any).id}`,
        date: ld.date,
        person_id: inst.id,
        person_name: inst.name || inst.email,
        type: 'lab_assignment',
        start_time: ld.start_time,
        end_time: ld.end_time,
        // 4h fallback when times are missing (older rows pre-date the
        // required start/end times) so legacy lab assignments still
        // count toward the future heat-map / hours-sidebar totals.
        hours: labDayHours(ld.start_time, ld.end_time),
        lab_day_id: (r as any).lab_day_id,
        role: (r as any).role,
        notes: (r as any).notes,
        label: ld.title || null,
      });
    }

    // 1b. Station-level instructor assignments. Surfaces three cases
    //     the lab_day_roles table misses:
    //       • Schafer / Young assigned to specific NREMT skill
    //         stations (BVM, NRB, Suction) without a top-level
    //         lab-day role
    //       • Volunteer examiners (is_part_time may or may not be set)
    //         brought in for a single station via station_instructors
    //       • The .additional_instructor_id slot when a station has
    //         a co-instructor distinct from the primary
    //
    //     We collapse multiple stations on the same day into one
    //     block per (person, lab_day) so a person running 3 stations
    //     shows once with a "Stations: BVM, NRB, Suction" label
    //     rather than three stacked chips. The dedupe also covers the
    //     case where the primary AND additional slot reference the
    //     same person, AND the case where lab_day_roles already
    //     captured them (set above).
    type StationAggKey = string; // `${personId}|${labDayId}`
    const stationAgg = new Map<
      StationAggKey,
      { person: { id: string; name: string; email: string }; labDayId: string; titles: Set<string> }
    >();
    const collectStationPerson = (
      person: { id: string; name?: string | null; email?: string | null } | null | undefined,
      labDayId: string,
      stationTitle: string | null
    ) => {
      if (!person?.id || !labDayId) return;
      // Skip if lab_day_roles already wrote a block for this pair.
      if (labAssignmentSeen.has(seenKey(person.id, labDayId))) return;
      const key: StationAggKey = seenKey(person.id, labDayId);
      const existing = stationAgg.get(key);
      const titles = existing?.titles ?? new Set<string>();
      if (stationTitle) titles.add(stationTitle);
      stationAgg.set(key, {
        person: {
          id: person.id,
          name: person.name || person.email || 'Unknown',
          email: person.email || '',
        },
        labDayId,
        titles,
      });
    };

    for (const st of stationsRes.data ?? []) {
      const labDayId = (st as any).lab_day_id as string | null;
      if (!labDayId || !labDayIdsInRange.has(labDayId)) continue;
      const stationTitle =
        (st as any).custom_title || (st as any).skill_name || null;

      // Primary instructor slot.
      const primary = Array.isArray((st as any).instructor) ? (st as any).instructor[0] : (st as any).instructor;
      collectStationPerson(primary, labDayId, stationTitle);

      // Secondary "additional_instructor" slot.
      const secondary = Array.isArray((st as any).additional_instructor)
        ? (st as any).additional_instructor[0]
        : (st as any).additional_instructor;
      collectStationPerson(secondary, labDayId, stationTitle);

      // station_instructors many-to-many — covers volunteers added via
      // the modal that supports multiple examiners per station.
      const sInstructors = Array.isArray((st as any).station_instructors)
        ? (st as any).station_instructors
        : [];
      for (const si of sInstructors) {
        const u = Array.isArray(si.user) ? si.user[0] : si.user;
        collectStationPerson(u, labDayId, stationTitle);
      }
    }

    // Materialise the aggregated station assignments into blocks.
    for (const [, agg] of stationAgg) {
      const ld = labDayById.get(agg.labDayId);
      if (!ld) continue;
      remember(agg.person);
      // Title format: "Stations: BVM, NRB" (capped at first 3 names so
      // tiny day cells stay readable). Single-station shows just the
      // skill name without the "Stations:" prefix.
      const titleArr = Array.from(agg.titles);
      const label =
        titleArr.length === 0
          ? ld.title || 'Station examiner'
          : titleArr.length === 1
          ? titleArr[0]
          : `Stations: ${titleArr.slice(0, 3).join(', ')}${titleArr.length > 3 ? '…' : ''}`;
      blocks.push({
        id: `station-${agg.person.id}-${agg.labDayId}`,
        date: ld.date,
        person_id: agg.person.id,
        person_name: agg.person.name,
        type: 'lab_assignment',
        start_time: ld.start_time,
        end_time: ld.end_time,
        hours: labDayHours(ld.start_time, ld.end_time),
        lab_day_id: agg.labDayId,
        role: 'station_examiner',
        label,
      });
    }

    // 2. Confirmed shifts — open_shifts joined with shift_signups.
    for (const s of shiftsRes.data ?? []) {
      const signups = Array.isArray((s as any).shift_signups) ? (s as any).shift_signups : [];
      for (const su of signups) {
        const inst = Array.isArray(su.instructor) ? su.instructor[0] : su.instructor;
        if (!inst) continue;
        remember(inst);
        blocks.push({
          id: `shift-${su.id}`,
          date: (s as any).date,
          person_id: inst.id,
          person_name: inst.name || inst.email,
          type: 'shift',
          start_time: (s as any).start_time,
          end_time: (s as any).end_time,
          hours: durationHours((s as any).start_time, (s as any).end_time),
          shift_id: (s as any).id,
          label: (s as any).title || (s as any).location || null,
        });
      }
    }

    // 3. Availability + recurring (recurring templates materialise
    //    rows in instructor_availability with source_template_id set,
    //    so we tag the block type by the presence of that column).
    //
    //    Per the hour-sources clarification: availability + recurring
    //    are PROJECTED, not worked hours. They render as outlined
    //    blocks for context ("Jimi's free Wednesday afternoon") but
    //    must NOT count toward heat-map / sidebar totals — so we set
    //    `hours: null` here. Downstream sum logic does `b.hours ?? 0`
    //    and naturally excludes them. Block duration for the tooltip
    //    can be re-derived from start_time/end_time on the client.
    for (const a of availabilityRes.data ?? []) {
      const inst = Array.isArray((a as any).instructor) ? (a as any).instructor[0] : (a as any).instructor;
      if (!inst) continue;
      remember(inst);
      const isRecurring = !!(a as any).source_template_id;
      const start = (a as any).is_all_day ? null : (a as any).start_time;
      const end = (a as any).is_all_day ? null : (a as any).end_time;
      blocks.push({
        id: `${isRecurring ? 'rec' : 'avail'}-${(a as any).id}`,
        date: (a as any).date,
        person_id: inst.id,
        person_name: inst.name || inst.email,
        type: isRecurring ? 'recurring' : 'availability',
        start_time: start,
        end_time: end,
        hours: null,
      });
    }

    // 4. Manual hour logs — show as a striped block since these are
    //    self-reported (no shift / no lab assignment).
    for (const h of hoursRes.data ?? []) {
      const u = Array.isArray((h as any).user) ? (h as any).user[0] : (h as any).user;
      if (!u) continue;
      remember(u);
      blocks.push({
        id: `manual-${(h as any).id}`,
        date: (h as any).date,
        person_id: u.id,
        person_name: u.name || u.email,
        type: 'manual_hours',
        start_time: null,
        end_time: null,
        hours: ((h as any).duration_minutes ?? 0) / 60,
        notes: (h as any).notes,
        label: (h as any).entry_type || null,
      });
    }

    // ---------------------------------------------------------------
    // Backfill role + part-time on people we've seen (single roundtrip
    // — peopleMap is bounded by who actually has activity in window).
    // ---------------------------------------------------------------
    const peopleIds = Array.from(peopleMap.keys());
    let people: Array<Person & { role?: string; is_part_time?: boolean }> = [];
    if (peopleIds.length > 0) {
      const { data: peopleRows } = await supabase
        .from('lab_users')
        .select('id, name, email, role, is_part_time')
        .in('id', peopleIds);
      people = (peopleRows ?? []).map(p => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: p.role,
        is_part_time: p.is_part_time ?? false,
      }));
    }

    // Lab days for the badge layer — return regardless of staffing.
    const lab_days = (labDaysRes.data ?? []).map((d: any) => ({
      id: d.id,
      date: d.date,
      start_time: d.start_time,
      end_time: d.end_time,
      title: d.title,
      priority_flag: d.priority_flag ?? 'normal',
      priority_reason: d.priority_reason ?? null,
      is_nremt_testing: !!d.is_nremt_testing,
      cohort: Array.isArray(d.cohort) ? d.cohort[0] : d.cohort,
    }));

    return NextResponse.json({
      success: true,
      start_date: startDate,
      end_date: endDate,
      people,
      lab_days,
      blocks,
      // user echoed back is handy for the client if it ever wants to
      // call out "your assignments" within the coordinator view.
      caller: { email: user.email, role: callerRole },
    });
  } catch (e) {
    console.error('[coordinator-calendar GET] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
