import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

export type WhosComingGroup = 'full_time' | 'part_time' | 'other';

export interface WhosComingPerson {
  key: string;
  name: string;
  email: string | null;
  group: WhosComingGroup;
  /** Labels like "Lab Lead", "Roamer", "Attending", "Station 3", "Signed up". */
  tags: string[];
  /** lab_day_roles row id when this person was added on the day itself (removable here). */
  role_ids: string[];
  /** True when a station assignment, shift signup or volunteer registration also puts them on the day (managed elsewhere). */
  from_other_sources: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  lab_lead: 'Lab Lead',
  roamer: 'Roamer',
  observer: 'Observer',
  coordinator: 'Coordinator',
  attending: 'Attending',
};

// GET /api/lab-management/lab-days/[id]/whos-coming
// One read of everyone on the day, from the rows that already exist:
//   lab_day_roles (leads/roamers/attending/Other), station assignments,
//   confirmed part-timer/volunteer shift signups, volunteer registrations.
// Read-only; the add/remove path is /api/lab-management/lab-day-roles.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select('id, date, cohort:cohorts(program:programs(abbreviation))')
      .eq('id', labDayId)
      .single();
    if (labDayError || !labDay) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    const [rolesRes, stationsRes, shiftsRes, eventsRes] = await Promise.all([
      supabase
        .from('lab_day_roles')
        .select('id, role, other_name, instructor:lab_users!lab_day_roles_instructor_id_fkey(id, name, email, role, is_part_time)')
        .eq('lab_day_id', labDayId),
      supabase
        .from('lab_stations')
        .select('station_number, instructor_name, instructor_email, station_instructors(user_name, user_email)')
        .eq('lab_day_id', labDayId)
        .order('station_number'),
      supabase
        .from('open_shifts')
        .select('id, lab_day_id, date, signups:shift_signups(status, instructor:lab_users!shift_signups_instructor_id_fkey(id, name, email, role, is_part_time))')
        .eq('is_cancelled', false)
        .or(`lab_day_id.eq.${labDayId},and(lab_day_id.is.null,date.eq.${labDay.date})`),
      supabase
        .from('volunteer_events')
        .select('id')
        .eq('linked_lab_day_id', labDayId),
    ]);

    const people = new Map<string, WhosComingPerson>();
    const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
    const groupFor = (u: { role?: string | null; is_part_time?: boolean | null } | null): WhosComingGroup =>
      u && (u.is_part_time || u.role === 'volunteer_instructor') ? 'part_time' : 'full_time';

    const add = (
      key: string,
      name: string,
      email: string | null,
      group: WhosComingGroup,
      tag: string | null,
      extra: { roleId?: string; fromOther?: boolean } = {},
    ) => {
      let p = people.get(key);
      if (!p) {
        p = { key, name, email, group, tags: [], role_ids: [], from_other_sources: false };
        people.set(key, p);
      }
      if (tag && !p.tags.includes(tag)) p.tags.push(tag);
      if (extra.roleId) p.role_ids.push(extra.roleId);
      if (extra.fromOther) p.from_other_sources = true;
    };
    const keyFor = (email: string | null | undefined, name: string) =>
      email ? email.toLowerCase() : `name:${name.toLowerCase()}`;

    // 1. Rows written on the day itself.
    for (const r of (rolesRes.data || []) as any[]) {
      const inst = first<any>(r.instructor);
      if (inst) {
        add(keyFor(inst.email, inst.name), inst.name || inst.email, inst.email || null, groupFor(inst), ROLE_LABELS[r.role] || r.role, { roleId: r.id });
      } else if (r.other_name) {
        add(`other:${r.id}`, r.other_name, null, 'other', ROLE_LABELS[r.role] || r.role, { roleId: r.id });
      }
    }

    // 2. Station assignments (managed in the station editor).
    const stationPeople: { name: string; email: string | null; station: number }[] = [];
    for (const s of (stationsRes.data || []) as any[]) {
      if (s.instructor_name || s.instructor_email) {
        stationPeople.push({ name: s.instructor_name || s.instructor_email, email: s.instructor_email || null, station: s.station_number });
      }
      for (const si of (s.station_instructors || []) as any[]) {
        if (si.user_name || si.user_email) {
          stationPeople.push({ name: si.user_name || si.user_email, email: si.user_email || null, station: s.station_number });
        }
      }
    }

    // 3. Confirmed part-timer / volunteer-instructor shift signups.
    const signupPeople: { name: string; email: string | null; user: any }[] = [];
    for (const sh of (shiftsRes.data || []) as any[]) {
      for (const su of (sh.signups || []) as any[]) {
        if (su.status !== 'confirmed') continue;
        const inst = first<any>(su.instructor);
        if (!inst) continue;
        signupPeople.push({ name: inst.name || inst.email, email: inst.email || null, user: inst });
      }
    }

    // Station-assigned people need their full-time / part-time flag from lab_users.
    const stationEmails = [...new Set(stationPeople.map(p => p.email?.toLowerCase()).filter(Boolean) as string[])];
    const userByEmail = new Map<string, any>();
    if (stationEmails.length > 0) {
      const { data: users } = await supabase
        .from('lab_users')
        .select('email, role, is_part_time')
        .in('email', stationEmails);
      (users || []).forEach((u: any) => userByEmail.set(String(u.email).toLowerCase(), u));
    }

    const stationsByPerson = new Map<string, { name: string; email: string | null; stations: Set<number> }>();
    for (const sp of stationPeople) {
      const key = keyFor(sp.email, sp.name);
      const entry = stationsByPerson.get(key) || { name: sp.name, email: sp.email, stations: new Set<number>() };
      entry.stations.add(sp.station);
      stationsByPerson.set(key, entry);
    }
    for (const [key, e] of stationsByPerson) {
      const u = e.email ? userByEmail.get(e.email.toLowerCase()) : null;
      const nums = [...e.stations].sort((a, b) => a - b);
      add(key, e.name, e.email, groupFor(u), `Station ${nums.join(', ')}`, { fromOther: true });
    }
    for (const sp of signupPeople) {
      add(keyFor(sp.email, sp.name), sp.name, sp.email, groupFor(sp.user), 'Signed up', { fromOther: true });
    }

    // 4. Volunteer registrations linked to this lab day.
    const eventIds = ((eventsRes.data || []) as { id: string }[]).map(e => e.id);
    if (eventIds.length > 0) {
      const { data: vols } = await supabase
        .from('volunteer_registrations')
        .select('name, email')
        .in('event_id', eventIds)
        .in('status', ['registered', 'confirmed']);
      (vols || []).forEach((v: any) => {
        if (!v.name) return;
        add(keyFor(v.email, v.name), v.name, v.email || null, 'part_time', 'Volunteer', { fromOther: true });
      });
    }

    // 5. Default roster for this lab day's program (program_default_instructors),
    // minus anyone who used "Remove me" on this day (lab_day_optouts).
    try {
      const cohort = first<any>((labDay as any).cohort);
      const abbr = String(first<any>(cohort?.program)?.abbreviation || '');
      if (abbr) {
        const [rosterRes, optoutRes] = await Promise.all([
          supabase
            .from('program_default_instructors')
            .select('user:lab_users!inner(id, name, email, role, is_part_time, is_active), program:programs!inner(abbreviation)')
            .eq('program.abbreviation', abbr),
          supabase.from('lab_day_optouts').select('user_id').eq('lab_day_id', labDayId),
        ]);
        const out = new Set(((optoutRes.data || []) as { user_id: string }[]).map(o => o.user_id));
        for (const r of (rosterRes.data || []) as any[]) {
          const u = first<any>(r.user);
          if (!u || u.is_active === false || out.has(u.id)) continue;
          add(keyFor(u.email, u.name), u.name || u.email, u.email || null, groupFor(u), 'Default', { fromOther: true });
        }
      }
    } catch (err) {
      // A failed default read only narrows the list; it never blocks the response.
      console.error('whos-coming default roster read failed:', err);
    }

    const order: Record<WhosComingGroup, number> = { full_time: 0, part_time: 1, other: 2 };
    const list = [...people.values()].sort((a, b) => order[a.group] - order[b.group] || a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, people: list });
  } catch (error: unknown) {
    console.error('Error building whos-coming:', error);
    return NextResponse.json({ success: false, error: 'Failed to load who is coming' }, { status: 500 });
  }
}
