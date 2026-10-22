import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCohortNumber } from '@/lib/format-cohort';

/**
 * GET /api/admin/view-as/cohorts   (card STUDENT VIEW 3/4)
 *
 * Step 1 of the "View as a student" picker: active (non-archived) cohorts
 * only, for the cohort chooser. Never returns students directly — see
 * /api/admin/view-as/students?cohort_id=.
 */
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const { data: cohorts, error } = await supabase
    .from('cohorts')
    .select('id, cohort_number, display_name, is_test, program:programs(abbreviation)')
    .eq('is_archived', false)
    .order('cohort_number', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = (cohorts ?? []).map((c) => {
    const program = Array.isArray(c.program) ? c.program[0] : c.program;
    const label =
      c.display_name ||
      `${program?.abbreviation ?? ''} Group ${formatCohortNumber(c.cohort_number)}`.trim();
    return { id: c.id, label, isTest: c.is_test === true };
  });

  return NextResponse.json({ success: true, cohorts: rows });
}
