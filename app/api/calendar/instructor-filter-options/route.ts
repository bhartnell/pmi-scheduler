import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/calendar/instructor-filter-options
 *
 * Returns the set of instructors actually assigned to ANYTHING on
 * the master calendar — used to populate the "By Instructor"
 * filter dropdown on /calendar.
 *
 * Source-of-truth = the union of three assignment tables:
 *   1. pmi_block_instructors  (class teaching assignments)
 *   2. lab_day_roles          (lab leads / roamers / observers)
 *   3. station_instructors    (station-level assignments)
 *
 * Falls through to the lab_users.role-based list ONLY for users
 * who don't appear in any assignment table — this catches recently-
 * created accounts that would otherwise be invisible until they
 * pick up their first row. The role filter intentionally accepts
 * lead_instructor / admin / superadmin / volunteer_instructor as
 * well as 'instructor' so cases like Josh Lomonaco (lead_instructor
 * teaching EMS classes) appear without needing a role rewrite.
 *
 * Optional query params:
 *   start_date, end_date — when both present, scope source #1+#2
 *                          to that window so off-season instructors
 *                          don't pollute the dropdown.
 *
 * Response:
 *   { success: true,
 *     instructors: [{ id, name, email, sources: ['class','lab_role',...] }]
 *   }
 *
 * `sources` lists which assignment tables produced this user, so
 * the UI can hover a chip explaining "Why is this person here?".
 */
export async function GET(request: NextRequest) {
  try {
    // Same auth level as the existing /api/lab-management/instructors
    // fallback the calendar uses today — non-admin viewers can pull
    // the list to render the filter.
    const auth = await requireAuth('volunteer_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const userIdSources = new Map<string, Set<string>>();
    const addSource = (id: string | null | undefined, src: string) => {
      if (!id) return;
      const set = userIdSources.get(id) ?? new Set<string>();
      set.add(src);
      userIdSources.set(id, set);
    };

    // 1. pmi_block_instructors — every class teaching assignment.
    //    Date filter applied via the join to pmi_schedule_blocks
    //    only when both dates are present; otherwise we union the
    //    full table so off-season instructors still show up.
    try {
      let blockQuery = supabase
        .from('pmi_block_instructors')
        .select('instructor_id, schedule_block_id, schedule_block:pmi_schedule_blocks(date)')
        .not('instructor_id', 'is', null);
      // Note: filtering on the embedded relation would require a
      // separate query path; just fetch all rows and date-filter
      // in JS — the table is small (~hundreds of rows).
      const { data: bi } = await blockQuery;
      for (const row of bi ?? []) {
        if (startDate && endDate) {
          const sb = Array.isArray((row as { schedule_block?: unknown }).schedule_block)
            ? (row as { schedule_block: Array<{ date?: string }> }).schedule_block[0]
            : (row as { schedule_block?: { date?: string } }).schedule_block;
          const d = sb?.date;
          if (!d || d < startDate || d > endDate) continue;
        }
        addSource(row.instructor_id, 'class');
      }
    } catch (err) {
      console.warn('[instructor-filter-options] pmi_block_instructors lookup failed', err);
    }

    // 2. lab_day_roles — lab lead / roamer / observer.
    try {
      let roleQuery = supabase
        .from('lab_day_roles')
        .select('instructor_id, lab_day:lab_days(date)')
        .not('instructor_id', 'is', null);
      const { data: roles } = await roleQuery;
      for (const r of roles ?? []) {
        if (startDate && endDate) {
          const ld = Array.isArray((r as { lab_day?: unknown }).lab_day)
            ? (r as { lab_day: Array<{ date?: string }> }).lab_day[0]
            : (r as { lab_day?: { date?: string } }).lab_day;
          const d = ld?.date;
          if (!d || d < startDate || d > endDate) continue;
        }
        addSource(r.instructor_id as string, 'lab_role');
      }
    } catch (err) {
      console.warn('[instructor-filter-options] lab_day_roles lookup failed', err);
    }

    // 3. station_instructors — joined via station → lab_day for
    //    optional date filtering.
    try {
      const { data: si } = await supabase
        .from('station_instructors')
        .select('user_id, user_email, station:lab_stations(lab_day:lab_days(date))')
        .not('user_id', 'is', null);
      for (const r of si ?? []) {
        if (startDate && endDate) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const station = Array.isArray((r as any).station) ? (r as any).station[0] : (r as any).station;
          const labDay = Array.isArray(station?.lab_day) ? station.lab_day[0] : station?.lab_day;
          const d = labDay?.date;
          if (!d || d < startDate || d > endDate) continue;
        }
        addSource(r.user_id as string, 'station');
      }
    } catch (err) {
      console.warn('[instructor-filter-options] station_instructors lookup failed', err);
    }

    // Resolve user_id → name + email for everyone we found.
    const ids = Array.from(userIdSources.keys());
    let assignedUsers: Array<{
      id: string;
      name: string | null;
      email: string | null;
    }> = [];
    if (ids.length > 0) {
      const { data: users, error } = await supabase
        .from('lab_users')
        .select('id, name, email, is_active')
        .in('id', ids);
      if (error) throw error;
      assignedUsers = (users ?? [])
        .filter(u => u.is_active !== false)
        .map(u => ({ id: u.id, name: u.name ?? null, email: u.email ?? null }));
    }

    // Fall-through: include role-based instructors not yet in any
    // assignment table so brand-new users still appear. Avoids the
    // common "I just got added but I'm not in the dropdown" bug.
    const seenIds = new Set(assignedUsers.map(u => u.id));
    try {
      const { data: roleUsers } = await supabase
        .from('lab_users')
        .select('id, name, email')
        .in('role', [
          'instructor',
          'lead_instructor',
          'admin',
          'superadmin',
          'volunteer_instructor',
        ])
        .eq('is_active', true);
      for (const u of roleUsers ?? []) {
        if (seenIds.has(u.id)) continue;
        assignedUsers.push({ id: u.id, name: u.name ?? null, email: u.email ?? null });
        userIdSources.set(u.id, new Set(['role_only']));
      }
    } catch (err) {
      console.warn('[instructor-filter-options] role fallback failed', err);
    }

    // Final shape — sorted alphabetically, with source array per row.
    const instructors = assignedUsers
      .map(u => ({
        id: u.id,
        name: u.name ?? '(unnamed)',
        email: u.email,
        sources: Array.from(userIdSources.get(u.id) ?? []),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, instructors });
  } catch (error) {
    console.error('instructor-filter-options error', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load instructor filter options' },
      { status: 500 }
    );
  }
}
