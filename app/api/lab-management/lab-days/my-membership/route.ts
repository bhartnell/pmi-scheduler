import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lab-management/lab-days/my-membership?ids=a,b,c
// For the home calendar's Sign up button (TRIM 6/7a-4d): which of these lab
// days the signed-in user is already on, and the lab_day_roles row ids that
// put them there (so "You're in" can remove them). Same sources the lab day
// page's Who's coming block reads: lab_day_roles, station instructors.
// Read-only.
export async function GET(request: NextRequest) {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;
  const signedIn = auth.user;
  let user = signedIn;
  let viewingAs = false;

  // View as (admin and up): compute everything for THAT person, read-only, so
  // the Sign up / You're in buttons render exactly as they would for them.
  const asId = request.nextUrl.searchParams.get('as');
  if (asId && asId !== signedIn.id) {
    if (!hasMinRole(signedIn.role as never, 'admin')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { data: target } = await getSupabaseAdmin()
      .from('lab_users')
      .select('id, name, email, role')
      .eq('id', asId)
      .maybeSingle();
    if (!target) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    user = target as typeof signedIn;
    viewingAs = true;
  }

  // volunteer_instructor ranks level 2, same as instructor (lib/permissions.ts),
  // so this already admits volunteers; the POST needs the same level.
  const canSignUp = hasMinRole(user.role as never, 'instructor');

  const ids = [
    ...new Set(
      (request.nextUrl.searchParams.get('ids') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 200);
  if (ids.length === 0) return NextResponse.json({ success: true, user_id: user.id, can_sign_up: canSignUp, viewing_as: viewingAs, days: {} });

  const supabase = getSupabaseAdmin();
  const email = user.email.toLowerCase();

  try {
    const [rolesRes, stationsRes, signupsRes, rosterRes, daysRes, optoutsRes] = await Promise.all([
      supabase.from('lab_day_roles').select('id, lab_day_id, role').eq('instructor_id', user.id).in('lab_day_id', ids),
      supabase
        .from('lab_stations')
        .select('lab_day_id, instructor_email, station_instructors(user_email)')
        .in('lab_day_id', ids),
      // Confirmed shift signups put a person on the day too (Who's coming source 3).
      supabase
        .from('open_shifts')
        .select('lab_day_id, signups:shift_signups!inner(status, instructor_id)')
        .eq('is_cancelled', false)
        .in('lab_day_id', ids)
        .eq('signups.status', 'confirmed')
        .eq('signups.instructor_id', user.id),
      // Default roster (program_default_instructors) programs this user is on,
      // the program of each lab day, and the user's opt-outs (6/7a-8c).
      supabase.from('program_default_instructors').select('program:programs!inner(abbreviation)').eq('user_id', user.id),
      supabase.from('lab_days').select('id, cohort:cohorts(program:programs(abbreviation))').in('id', ids),
      supabase.from('lab_day_optouts').select('lab_day_id').eq('user_id', user.id).in('lab_day_id', ids),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (stationsRes.error) throw stationsRes.error;

    const days: Record<string, { on: boolean; role_ids: string[]; default?: boolean; opted_out?: boolean }> = {};
    for (const id of ids) days[id] = { on: false, role_ids: [] };

    for (const r of rolesRes.data || []) {
      const d = days[r.lab_day_id as string];
      if (!d) continue;
      d.on = true;
      d.role_ids.push(r.id as string);
    }
    // A failed signup read only narrows "You're in"; it never blocks the response.
    for (const sh of (signupsRes.data || []) as unknown as { lab_day_id: string | null }[]) {
      const d = sh.lab_day_id ? days[sh.lab_day_id] : null;
      if (d) d.on = true;
    }
    for (const s of (stationsRes.data || []) as unknown as {
      lab_day_id: string;
      instructor_email: string | null;
      station_instructors: { user_email: string | null }[] | null;
    }[]) {
      const d = days[s.lab_day_id];
      if (!d) continue;
      const mine =
        (s.instructor_email || '').toLowerCase() === email ||
        (s.station_instructors || []).some(
          si => (si.user_email || '').toLowerCase() === email,
        );
      if (mine) d.on = true;
    }

    // Default roster: on every lab day of a program the user is rostered for,
    // unless they removed themselves from that day. Failed reads only narrow
    // "You're in"; they never block the response.
    const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
    const rosterPrograms = new Set(
      ((rosterRes.data || []) as unknown as { program: unknown }[])
        .map(r => (first(r.program as { abbreviation: string } | null)?.abbreviation || '').toUpperCase())
        .filter(Boolean),
    );
    const optedOut = new Set(((optoutsRes.data || []) as { lab_day_id: string }[]).map(o => o.lab_day_id));
    for (const ld of (daysRes.data || []) as unknown as { id: string; cohort: unknown }[]) {
      const d = days[ld.id];
      if (!d) continue;
      if (optedOut.has(ld.id)) {
        d.opted_out = true;
        continue;
      }
      const cohort = first(ld.cohort as { program: unknown } | null);
      const abbr = (first(cohort?.program as { abbreviation: string } | null)?.abbreviation || '').toUpperCase();
      if (abbr && rosterPrograms.has(abbr)) {
        d.default = true;
        d.on = true;
      }
    }

    return NextResponse.json({ success: true, user_id: user.id, can_sign_up: canSignUp, viewing_as: viewingAs, days });
  } catch (error) {
    console.error('Error reading lab day membership:', error);
    return NextResponse.json({ success: false, error: 'Failed to read membership' }, { status: 500 });
  }
}
