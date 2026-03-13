import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { getInstructorAvailability } from '@/lib/lvfr-availability';

// GET /api/lvfr-aemt/planner/availability — Get instructor availability for planner overlay
// Uses dynamic calculation from lib/lvfr-availability.ts with manual overrides.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Get instructor details
  const { data: instructors } = await supabase
    .from('lab_users')
    .select('id, name, email')
    .in('role', ['instructor', 'admin', 'superadmin', 'lead_instructor'])
    .eq('is_active', true)
    .order('name');

  // Get course days for date range
  const { data: courseDays } = await supabase
    .from('lvfr_aemt_course_days')
    .select('date')
    .order('date');

  // Build availability from DYNAMIC CALCULATION
  const byDate: Record<string, Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean; status: string }>> = {};

  for (const day of courseDays || []) {
    const dateStr = typeof day.date === 'string' ? day.date.split('T')[0] : day.date;
    if (!byDate[dateStr]) byDate[dateStr] = {};

    for (const inst of instructors || []) {
      const result = getInstructorAvailability(inst.name, new Date(dateStr + 'T12:00:00'));
      if (result) {
        byDate[dateStr][inst.id] = {
          am1: result.blocks.am1,
          mid: result.blocks.mid,
          pm1: result.blocks.pm1,
          pm2: result.blocks.pm2,
          status: result.status,
        };
      }
    }
  }

  // Layer manual overrides on top
  const { data: overrides } = await supabase
    .from('lvfr_aemt_instructor_availability')
    .select('instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status')
    .eq('source', 'manual_override');

  for (const o of overrides || []) {
    const dateStr = typeof o.date === 'string' ? o.date.split('T')[0] : o.date;
    if (!byDate[dateStr]) byDate[dateStr] = {};
    byDate[dateStr][o.instructor_id] = {
      am1: o.am1_available,
      mid: o.mid_available,
      pm1: o.pm1_available,
      pm2: o.pm2_available,
      status: o.status,
    };
  }

  return NextResponse.json({
    instructors: instructors || [],
    availability: byDate,
  });
}
