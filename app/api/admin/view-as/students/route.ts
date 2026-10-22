import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/view-as/students?cohort_id=   (card STUDENT VIEW 3/4)
 *
 * Step 2 of the "View as a student" picker: one cohort's students (never a
 * flat list of all students), excluding graduated and withdrawn. Test
 * students are returned first with isTest:true so the picker can group them
 * under a "Test" label, then real students alphabetically.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const cohortId = request.nextUrl.searchParams.get('cohort_id');
  if (!cohortId) {
    return NextResponse.json({ success: false, error: 'cohort_id is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: students, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, is_test')
    .eq('cohort_id', cohortId)
    .in('status', ['active', 'on_hold'])
    .not('email', 'is', null)
    .order('is_test', { ascending: false })
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = (students ?? []).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    isTest: s.is_test === true,
  }));

  return NextResponse.json({ success: true, students: rows });
}
