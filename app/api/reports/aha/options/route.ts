import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Picker options for the AHA export page: cohorts + instructors who have AHA
 * credentials on file (eligible to be credited/signed on a form). Read-only.
 */
export async function GET() {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const supabase = getSupabaseAdmin();

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, cohort_number, current_semester')
    .order('cohort_number', { ascending: false });

  const { data: instructors } = await supabase
    .from('lab_users')
    .select('id, name, aha_instructor_number')
    .not('aha_instructor_number', 'is', null)
    .eq('is_active', true)
    .order('name');

  return NextResponse.json({
    success: true,
    cohorts: (cohorts ?? []).map((c) => ({
      id: c.id,
      label: `Cohort ${c.cohort_number ?? '?'}${c.current_semester ? ` · S${c.current_semester}` : ''}`,
    })),
    instructors: (instructors ?? []).map((i) => ({ id: i.id, name: i.name, ahaNumber: i.aha_instructor_number })),
  });
}
