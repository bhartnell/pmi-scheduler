import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lvfr-aemt/planner/instructors — all active instructor-eligible lab_users,
// for assigning to a plan_placements row. Deliberately independent of the
// availability feed (lib/lvfr-availability.ts only computes availability for a
// hardcoded name set), so any lab_users instructor is assignable, not just those three.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lab_users')
    .select('id, name, email')
    .in('role', ['instructor', 'admin', 'superadmin', 'lead_instructor'])
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ instructors: data || [] });
}
