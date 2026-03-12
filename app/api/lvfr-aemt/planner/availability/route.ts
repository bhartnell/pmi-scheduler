import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lvfr-aemt/planner/availability — Get instructor availability for planner overlay
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Get all instructor availability
  const { data: availability } = await supabase
    .from('lvfr_aemt_instructor_availability')
    .select('instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status, notes')
    .order('date');

  // Get instructor details
  const { data: instructors } = await supabase
    .from('lab_users')
    .select('id, name, email')
    .in('role', ['instructor', 'admin', 'superadmin'])
    .eq('is_active', true)
    .order('name');

  // Group availability by date
  const byDate: Record<string, Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean; status: string }>> = {};
  for (const a of (availability || [])) {
    const dateKey = typeof a.date === 'string' ? a.date.split('T')[0] : a.date;
    if (!byDate[dateKey]) byDate[dateKey] = {};
    byDate[dateKey][a.instructor_id] = {
      am1: a.am1_available,
      mid: a.mid_available,
      pm1: a.pm1_available,
      pm2: a.pm2_available,
      status: a.status,
    };
  }

  return NextResponse.json({
    instructors: instructors || [],
    availability: byDate,
  });
}
