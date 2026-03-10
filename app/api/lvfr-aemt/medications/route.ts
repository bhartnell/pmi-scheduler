import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/medications
//
// List all 8 medications. Available to LVFR students and instructors.
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor') &&
      user.role !== 'agency_liaison' &&
      user.role !== 'agency_observer' &&
      user.role !== 'student') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: medications, error } = await supabase
    .from('lvfr_aemt_medications')
    .select('*')
    .order('generic_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ medications: medications || [] });
}
