import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { getInstructorAvailability } from '@/lib/lvfr-availability';

// GET /api/lvfr-aemt/planner/availability — Get instructor availability for planner overlay
// Uses dynamic calculation from lib/lvfr-availability.ts with manual overrides.
// Returns both a flat array (for planner backward compat) and a structured byDate object.
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
    .select('date, day_number')
    .order('date');

  // Build availability from DYNAMIC CALCULATION
  const byDate: Record<string, Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean; status: string; label: string; notes: string }>> = {};

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
          label: result.label,
          notes: result.notes,
        };
      }
    }
  }

  // Layer manual overrides on top
  const { data: overrides } = await supabase
    .from('lvfr_aemt_instructor_availability')
    .select('instructor_id, date, am1_available, mid_available, pm1_available, pm2_available, status, notes')
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
      label: o.notes || o.status,
      notes: o.notes || '',
    };
  }

  // Build instructor lookup
  const instMap = new Map((instructors || []).map(i => [i.id, i]));

  // Build flat array for planner backward compatibility
  // Each entry = one instructor on one date, with block-level booleans
  const flatAvailability: Array<{
    date: string;
    instructor_id: string;
    instructor_name: string;
    instructor_email: string;
    am1: boolean;
    mid: boolean;
    pm1: boolean;
    pm2: boolean;
    status: string;
    label: string;
    notes: string;
  }> = [];

  for (const [dateStr, instEntries] of Object.entries(byDate)) {
    for (const [instId, blocks] of Object.entries(instEntries)) {
      const inst = instMap.get(instId);
      flatAvailability.push({
        date: dateStr,
        instructor_id: instId,
        instructor_name: inst?.name || 'Unknown',
        instructor_email: inst?.email || '',
        am1: blocks.am1,
        mid: blocks.mid,
        pm1: blocks.pm1,
        pm2: blocks.pm2,
        status: blocks.status,
        label: blocks.label,
        notes: blocks.notes,
      });
    }
  }

  return NextResponse.json({
    instructors: instructors || [],
    availability: flatAvailability,
    byDate,
  });
}
