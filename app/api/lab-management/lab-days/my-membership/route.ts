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
  const { user } = auth;

  // POST /lab-day-roles needs instructor; volunteers keep their own sign-up path.
  const canSignUp = hasMinRole(user.role as never, 'instructor');

  const ids = [
    ...new Set(
      (request.nextUrl.searchParams.get('ids') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 200);
  if (ids.length === 0) return NextResponse.json({ success: true, user_id: user.id, can_sign_up: canSignUp, days: {} });

  const supabase = getSupabaseAdmin();
  const email = user.email.toLowerCase();

  try {
    const [rolesRes, stationsRes] = await Promise.all([
      supabase.from('lab_day_roles').select('id, lab_day_id, role').eq('instructor_id', user.id).in('lab_day_id', ids),
      supabase
        .from('lab_stations')
        .select('lab_day_id, instructor_email, station_instructors(user_email)')
        .in('lab_day_id', ids),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (stationsRes.error) throw stationsRes.error;

    const days: Record<string, { on: boolean; role_ids: string[] }> = {};
    for (const id of ids) days[id] = { on: false, role_ids: [] };

    for (const r of rolesRes.data || []) {
      const d = days[r.lab_day_id as string];
      if (!d) continue;
      d.on = true;
      d.role_ids.push(r.id as string);
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

    return NextResponse.json({ success: true, user_id: user.id, can_sign_up: canSignUp, days });
  } catch (error) {
    console.error('Error reading lab day membership:', error);
    return NextResponse.json({ success: false, error: 'Failed to read membership' }, { status: 500 });
  }
}
