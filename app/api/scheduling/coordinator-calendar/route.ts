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
  /** lab_assignment | shift | manual_hours | availability | recurring | class_teaching */
  type: 'lab_assignment' | 'shift' | 'manual_hours' | 'availability' | 'recurring' | 'class_teaching';
  start_time: string | null;
  end_time: string | null;
  hours: number | null;
  lab_day_id?: string | null;
  shift_id?: string | null;
  role?: string | null;
  notes?: string | null;
  /** Free-form label the client can use as a tooltip ("EMS 111", "Phase 1 lab", etc.). */
  label?: string | null;
  /**
   * Optional client-side navigation target. When set, the calendar
   * wraps the block in a <Link href={...}>. Used today for LVFR
   * collapsed session blocks → /lvfr-aemt/day/[date], future use for
   * shift detail pages once those exist.
   */
  link?: string | null;
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

    const supabase = getSupabaseAdmin();
    const { data: callerRow } = await supabase
      .from('lab_users')
      .select('id, role, lvfr_platoon')
      .ilike('email', session.user.email || '')
      .single();
    const callerRole = callerRow?.role ?? null;
    const callerUserId = callerRow?.id ?? null;
    const callerLvfrPlatoon = (callerRow as { lvfr_platoon?: string } | null)?.lvfr_platoon ?? null;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    // Personal mode: instructor sees only their own assignments + the
    // priority badge layer (lab_days are public — every instructor
    // benefits from knowing which days are NREMT / ACLS even if
    // they're not assigned). Drops the lead_instructor gate so a
    // part-timer can plan around their own commitments without admin
    // access. The coordinator (full) mode stays gated to leads+.
    const personal = searchParams.get('personal') === 'true';

    if (!personal) {
      if (!callerRole || !hasMinRole(callerRole, 'lead_instructor')) {
        return NextResponse.json(
          { error: 'Forbidden — lead instructor or above required' },
          { status: 403 }
        );
      }
    } else {
      // Personal mode requires a resolvable lab_users row to scope by.
      if (!callerUserId) {
        return NextResponse.json(
          { error: 'No lab_users row found for caller' },
          { status: 403 }
        );
      }
    }

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
    const [labDaysRes, rolesRes, shiftsRes, availabilityRes, hoursRes, blocksRes] =
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

        // pmi_schedule_blocks — class-teaching hours (lecture, lab,
        // exam blocks from the planner). Only blocks with at least
        // one instructor assigned + status != 'cancelled' contribute
        // to the coordinator view. Without this query, a class like
        // Gannon's EMS 121 that's assigned in the planner doesn't
        // show as "Gannon teaching" on the coordinator calendar.
        supabase
          .from('pmi_schedule_blocks')
          .select(`
            id, date, start_time, end_time, block_type, title, course_name, status,
            instructor_id, additional_instructor_id,
            instructor:instructor_id(id, name, email),
            additional_instructor:additional_instructor_id(id, name, email),
            program_schedule:pmi_program_schedules!pmi_schedule_blocks_program_schedule_id_fkey(
              cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
                cohort_number,
                program:programs(abbreviation)
              )
            )
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'cancelled')
          .or('instructor_id.not.is.null,additional_instructor_id.not.is.null')
          .order('date'),
      ]);

    if (labDaysRes.error) throw labDaysRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (shiftsRes.error) throw shiftsRes.error;
    if (availabilityRes.error) throw availabilityRes.error;
    if (hoursRes.error) throw hoursRes.error;
    if (blocksRes.error) throw blocksRes.error;

    // LVFR platoon schedule for the requested date range. One row
    // per date with the resolved platoon (A/B/C/off). Drives:
    //   - Personal-mode overlays (Jimi sees gray "on duty @ LVFR"
    //     on dates matching his lvfr_platoon)
    //   - Coordinator A/B/C badges per day
    // Best-effort — failure here doesn't break the calendar grid.
    const lvfrRes = await supabase
      .from('lvfr_platoon_schedule')
      .select('date, platoon, is_bid_day, notes')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');
    const lvfr_platoons: Array<{ date: string; platoon: string; is_bid_day?: boolean; notes?: string | null }> =
      (lvfrRes.data ?? []).map((r: any) => ({
        date: r.date,
        platoon: r.platoon,
        is_bid_day: !!r.is_bid_day,
        notes: r.notes ?? null,
      }));

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
            instructor_id, additional_instructor_id, instructor_email, instructor_name,
            instructor:instructor_id(id, name, email),
            additional_instructor:additional_instructor_id(id, name, email),
            station_instructors(
              id, user_id, user_email, user_name, is_primary,
              user:user_id(id, name, email)
            )
          `)
          .in('lab_day_id', labDayIdsForStations)
      : { data: [], error: null };
    if (stationsRes.error) throw stationsRes.error;

    // Email-fallback lookup. Production data has the FK columns mostly
    // empty — stations + station_instructors store an `instructor_email`
    // (or `user_email`) without setting the corresponding *_id FK.
    // Without this fallback the Schafer-on-NREMT-day case never
    // surfaces because the FK joins above all return null. Walk the
    // station rows once to collect the orphan emails, then batch-look
    // them up by lower(email) so we have a single round-trip's worth
    // of overhead regardless of station count.
    const orphanEmails = new Set<string>();
    for (const st of stationsRes.data ?? []) {
      const s = st as any;
      if (!s.instructor_id && s.instructor_email) {
        orphanEmails.add(String(s.instructor_email).toLowerCase());
      }
      // Note: lab_stations has no `additional_instructor_email` column
      // in the schema — that slot is FK-only, so no fallback is needed.
      for (const si of (s.station_instructors ?? []) as any[]) {
        if (!si.user_id && si.user_email) {
          orphanEmails.add(String(si.user_email).toLowerCase());
        }
      }
    }
    type ResolvedPerson = { id: string; name: string; email: string };
    const emailToUser = new Map<string, ResolvedPerson>();
    if (orphanEmails.size > 0) {
      // Email casing is mixed across the codebase (some lowercase, some
      // mixed-case). The .in() filter is case-sensitive, so we look up
      // ilike-eq for each unique lowercase email by hitting the
      // `email.ilike.<email>` filter via or() — but PostgREST's `in()`
      // wins on round-trips. lab_users emails are stored lowercase per
      // current import scripts, so .in() with the lowercased orphan list
      // is the right tradeoff. Anything that misses falls through to a
      // synthetic person below so volunteers without a lab_users row
      // still appear in 'All instructors' scope.
      const list = Array.from(orphanEmails);
      const { data: matched } = await supabase
        .from('lab_users')
        .select('id, name, email')
        .in('email', list);
      for (const m of matched ?? []) {
        emailToUser.set(String(m.email).toLowerCase(), {
          id: m.id,
          name: m.name || m.email,
          email: m.email,
        });
      }
    }
    // Resolve a station's slot to a ResolvedPerson, preferring the FK
    // embed but falling back to email lookup, then to a synthetic
    // record (id = `email:${e}`, is_part_time defaults to false so the
    // person only shows in 'All instructors' scope) so we never silently
    // drop a station assignment.
    const resolveSlot = (
      embed: any,
      fallbackEmail: string | null | undefined,
      fallbackName: string | null | undefined
    ): ResolvedPerson | null => {
      const direct = Array.isArray(embed) ? embed[0] : embed;
      if (direct?.id) {
        return {
          id: direct.id,
          name: direct.name || direct.email,
          email: direct.email,
        };
      }
      if (!fallbackEmail) return null;
      const key = String(fallbackEmail).toLowerCase();
      const matched = emailToUser.get(key);
      if (matched) return matched;
      // Synthetic person — id is the email itself prefixed so the
      // legend / chip helpers don't collide with real lab_users UUIDs.
      return {
        id: `email:${key}`,
        name: fallbackName || fallbackEmail,
        email: fallbackEmail,
      };
    };

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
      const s = st as any;

      // Primary instructor slot — FK first, then instructor_email
      // fallback. The fallback is the common case for NREMT-day
      // station rosters (Schafer / Trevor / volunteer examiners).
      const primary = resolveSlot(
        s.instructor,
        s.instructor_email,
        s.instructor_name
      );
      collectStationPerson(primary, labDayId, stationTitle);

      // Secondary "additional_instructor" slot — FK only; the schema
      // has no `additional_instructor_email` column, so resolution is
      // direct.
      const secondary = resolveSlot(s.additional_instructor, null, null);
      collectStationPerson(secondary, labDayId, stationTitle);

      // station_instructors many-to-many — covers volunteers added
      // via the modal. The FK column user_id is frequently null in
      // production; user_email is the populated path. resolveSlot
      // covers both.
      const sInstructors = Array.isArray(s.station_instructors)
        ? s.station_instructors
        : [];
      for (const si of sInstructors) {
        const person = resolveSlot(si.user, si.user_email, si.user_name);
        collectStationPerson(person, labDayId, stationTitle);
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

    // 5. pmi_schedule_blocks with instructor_id / additional_instructor_id.
    //    Class-teaching, lab, and exam blocks from the planner that
    //    have at least one instructor assigned. Distinguishes itself
    //    from `lab_assignment` (lab_day_roles + lab_stations) so the
    //    UI / future hours-sidebar can split classroom hours from
    //    lab hours if useful. Hours = block duration. Cancelled
    //    blocks are pre-filtered server-side (.neq('status','cancelled')).
    //
    //    Label format: prefer the block.title, fall back to course_name
    //    (e.g. "EMS 121 Pharmacology"). Cohort context is appended so
    //    the chip says "EMS 121 — PM G14" when there's room.
    //
    //    LVFR special-case: per the LVFR AEMT revamp spec, the
    //    coordinator calendar shows ONE block per session per
    //    instructor (e.g. "Jimi — LVFR Morning") instead of N
    //    individual chapter / quiz / skill blocks. We divert LVFR
    //    blocks into a side bucket here and collapse them after the
    //    loop, so a 4-hour morning session of three pmi_schedule_blocks
    //    rows ends up as one chip linking to /lvfr-aemt/day/[date].
    type LvfrBucket = {
      date: string;
      person_id: string;
      person_name: string;
      session: 'morning' | 'afternoon';
      starts: string[];
      ends: string[];
      hours: number;
      source_block_ids: string[];
    };
    const lvfrBuckets = new Map<string, LvfrBucket>();

    for (const b of blocksRes.data ?? []) {
      const block = b as any;
      const ps = Array.isArray(block.program_schedule) ? block.program_schedule[0] : block.program_schedule;
      const cohort = ps?.cohort && (Array.isArray(ps.cohort) ? ps.cohort[0] : ps.cohort);
      const abbr = cohort?.program?.abbreviation as string | undefined;
      const cohortLabel = cohort
        ? `${abbr ?? ''} G${cohort.cohort_number ?? '?'}`.trim()
        : null;
      const baseLabel = block.title || block.course_name || 'Class block';
      const fullLabel = cohortLabel ? `${baseLabel} — ${cohortLabel}` : baseLabel;
      const isLvfr = abbr === 'LVFR';

      // Iterate the two FK slots. Both can resolve via the embed; no
      // email-fallback is needed here since the picker writes the FK
      // directly (unlike lab_stations.instructor_email legacy paths).
      for (const slot of [block.instructor, block.additional_instructor]) {
        const inst = Array.isArray(slot) ? slot[0] : slot;
        if (!inst?.id) continue;
        remember(inst);

        if (isLvfr) {
          // Bucket key: date + person + AM/PM. start_time '08:30:00'
          // → 8 (hours), < 12 means morning. Defensively default to
          // morning if start_time is null so the row still appears.
          const hour = parseInt((block.start_time ?? '0').split(':')[0], 10) || 0;
          const session: 'morning' | 'afternoon' = hour < 12 ? 'morning' : 'afternoon';
          const key = `${block.date}|${inst.id}|${session}`;
          const existing = lvfrBuckets.get(key);
          const hrs = durationHours(block.start_time, block.end_time) ?? 0;
          if (existing) {
            existing.starts.push(block.start_time);
            existing.ends.push(block.end_time);
            existing.hours += hrs;
            existing.source_block_ids.push(block.id);
          } else {
            lvfrBuckets.set(key, {
              date: block.date,
              person_id: inst.id,
              person_name: inst.name || inst.email,
              session,
              starts: [block.start_time],
              ends: [block.end_time],
              hours: hrs,
              source_block_ids: [block.id],
            });
          }
          continue;
        }

        blocks.push({
          id: `psb-${block.id}-${inst.id}`,
          date: block.date,
          person_id: inst.id,
          person_name: inst.name || inst.email,
          type: 'class_teaching',
          start_time: block.start_time,
          end_time: block.end_time,
          hours: durationHours(block.start_time, block.end_time),
          role: block.block_type || 'class',
          label: fullLabel,
        });
      }
    }

    // Emit one collapsed chip per (date, person, session) for LVFR.
    // Times shown are the spec's canonical session windows, not the
    // min/max of contributing blocks — keeps the calendar uniform
    // even if one instructor's individual blocks ran short of the
    // spec window. Underlying hours-summing reflects what was on the
    // master schedule, though.
    for (const bucket of lvfrBuckets.values()) {
      const isMorning = bucket.session === 'morning';
      blocks.push({
        id: `lvfr-${bucket.date}-${bucket.person_id}-${bucket.session}`,
        date: bucket.date,
        person_id: bucket.person_id,
        person_name: bucket.person_name,
        type: 'class_teaching',
        start_time: isMorning ? '07:30:00' : '12:30:00',
        end_time: isMorning ? '11:30:00' : '15:30:00',
        hours: Math.round(bucket.hours * 100) / 100,
        role: 'class',
        label: `LVFR ${isMorning ? 'Morning' : 'Afternoon'}`,
        link: `/lvfr-aemt/day/${bucket.date}`,
      });
    }

    // ---------------------------------------------------------------
    // Backfill role + part-time on people we've seen (single roundtrip
    // — peopleMap is bounded by who actually has activity in window).
    //
    // Two id flavours can appear in peopleMap:
    //   • UUID — real lab_users row, queryable via .in('id', ...)
    //   • "email:foo@bar"  — synthetic, created when a station's
    //     email-only assignment didn't match any lab_users row. These
    //     are passed through with is_part_time=false so they only
    //     surface in 'All instructors' scope.
    // We split the keyspace before the .in() call because lab_users.id
    // is a uuid column — passing a synthetic 'email:...' string blows
    // up the query with a parse error.
    // ---------------------------------------------------------------
    const allPeopleIds = Array.from(peopleMap.keys());
    const uuidLike = (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const realIds = allPeopleIds.filter(uuidLike);
    const syntheticIds = allPeopleIds.filter(id => !uuidLike(id));

    let people: Array<Person & { role?: string; is_part_time?: boolean }> = [];
    if (realIds.length > 0) {
      const { data: peopleRows } = await supabase
        .from('lab_users')
        .select('id, name, email, role, is_part_time')
        .in('id', realIds);
      people = (peopleRows ?? []).map(p => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: p.role,
        is_part_time: p.is_part_time ?? false,
      }));
    }
    // Synthetic people round-trip from peopleMap directly; they don't
    // have a role and default is_part_time=false so the legend / scope
    // toggle treat them as full-time / unknown.
    for (const sid of syntheticIds) {
      const p = peopleMap.get(sid);
      if (!p) continue;
      people.push({
        id: p.id,
        name: p.name,
        email: p.email,
        role: undefined,
        is_part_time: false,
      });
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

    // Personal-mode scoping. Filter blocks + people down to the
    // caller's own user_id so a regular instructor can't see other
    // people's confirmed shifts / availability windows. lab_days are
    // public (everyone benefits from seeing NREMT / ACLS day flags
    // even when not assigned) so they pass through unchanged.
    const personalBlocks = personal
      ? blocks.filter(b => b.person_id === callerUserId)
      : blocks;
    const personalPeople = personal
      ? people.filter(p => p.id === callerUserId)
      : people;

    return NextResponse.json({
      success: true,
      start_date: startDate,
      end_date: endDate,
      people: personalPeople,
      lab_days,
      blocks: personalBlocks,
      lvfr_platoons,
      mode: personal ? 'personal' : 'coordinator',
      // user echoed back is handy for the client if it ever wants to
      // call out "your assignments" within the coordinator view.
      caller: {
        email: user.email,
        role: callerRole,
        id: callerUserId,
        lvfr_platoon: callerLvfrPlatoon,
      },
    });
  } catch (e) {
    console.error('[coordinator-calendar GET] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
