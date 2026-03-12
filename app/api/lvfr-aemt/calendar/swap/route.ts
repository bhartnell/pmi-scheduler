import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isAgencyRole } from '@/lib/permissions';
import { logRecordAccess } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// POST /api/lvfr-aemt/calendar/swap
//
// Swap the dates of two course days.
// Body: { day_number_a: number, day_number_b: number }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  // Agency roles are strictly read-only
  if (isAgencyRole(user.role) || !hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Write access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { day_number_a, day_number_b } = body;

  if (!day_number_a || !day_number_b) {
    return NextResponse.json({ error: 'day_number_a and day_number_b are required' }, { status: 400 });
  }
  if (day_number_a === day_number_b) {
    return NextResponse.json({ error: 'Cannot swap a day with itself' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch both days
  const { data: days, error: fetchError } = await supabase
    .from('lvfr_aemt_course_days')
    .select('day_number, date, day_of_week, week_number')
    .in('day_number', [day_number_a, day_number_b]);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!days || days.length !== 2) {
    return NextResponse.json({ error: 'One or both days not found' }, { status: 404 });
  }

  const dayA = days.find(d => d.day_number === day_number_a)!;
  const dayB = days.find(d => d.day_number === day_number_b)!;

  // Validate both dates are valid class days (Tue/Wed/Thu)
  const validDays = ['Tuesday', 'Wednesday', 'Thursday'];
  if (!validDays.includes(dayA.day_of_week) || !validDays.includes(dayB.day_of_week)) {
    return NextResponse.json({ error: 'Both days must be on Tuesday, Wednesday, or Thursday' }, { status: 400 });
  }

  // Swap dates, day_of_week, and week_number between the two rows
  const { error: updateAError } = await supabase
    .from('lvfr_aemt_course_days')
    .update({
      date: dayB.date,
      day_of_week: dayB.day_of_week,
      week_number: dayB.week_number,
    })
    .eq('day_number', day_number_a);

  if (updateAError) {
    return NextResponse.json({ error: updateAError.message }, { status: 500 });
  }

  const { error: updateBError } = await supabase
    .from('lvfr_aemt_course_days')
    .update({
      date: dayA.date,
      day_of_week: dayA.day_of_week,
      week_number: dayA.week_number,
    })
    .eq('day_number', day_number_b);

  if (updateBError) {
    return NextResponse.json({ error: updateBError.message }, { status: 500 });
  }

  // Also update instructor_assignments date column
  await supabase
    .from('lvfr_aemt_instructor_assignments')
    .update({ date: dayB.date })
    .eq('day_number', day_number_a);

  await supabase
    .from('lvfr_aemt_instructor_assignments')
    .update({ date: dayA.date })
    .eq('day_number', day_number_b);

  // Audit log
  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    dataType: 'attendance',
    action: 'modify',
    route: '/api/lvfr-aemt/calendar/swap',
    details: {
      day_number_a,
      day_number_b,
      dateA: dayA.date,
      dateB: dayB.date,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
