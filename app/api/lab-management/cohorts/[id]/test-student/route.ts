import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { createEnrollmentForNewStudent } from '@/lib/student-enrollment';
import { formatCohortNumber } from '@/lib/format-cohort';
import { logAuditEvent } from '@/lib/audit';

const TEST_STUDENT_EMAIL_DOMAIN = 'test-student.invalid';

/**
 * POST /api/lab-management/cohorts/[id]/test-student
 *
 * Admin action "Add test student": creates ONE flagged row per call, named
 * "Test Student - <cohort label>", with a placeholder email on a reserved
 * .invalid domain (cannot be a Google account, so it cannot sign in).
 * Body { count?: number } (default 1, max 30). Test cohorts number them
 * "Test Student A, B, C..." per the generate-roster use. Never run
 * automatically; this is the only way test students are created.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(parseInt(String(body?.count ?? 1), 10) || 1, 1), 30);

    const { data: cohort, error: cErr } = await supabase
      .from('cohorts')
      .select('id, cohort_number, is_test, program:programs(abbreviation)')
      .eq('id', id)
      .single();
    if (cErr || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }
    const program = Array.isArray(cohort.program) ? cohort.program[0] : cohort.program;
    const label = `${program?.abbreviation ?? ''} Group ${formatCohortNumber(cohort.cohort_number)}`.trim();

    const { data: existing } = await supabase
      .from('students')
      .select('first_name, last_name, email')
      .eq('cohort_id', id)
      .eq('is_test', true);
    const taken = new Set((existing ?? []).map((s) => s.email));

    const rows = [];
    let n = 0;
    while (rows.length < count && n < 200) {
      n += 1;
      const suffix = count > 1 || (existing?.length ?? 0) > 0 ? ` ${String.fromCharCode(64 + ((n - 1) % 26) + 1)}${n > 26 ? Math.ceil(n / 26) : ''}` : '';
      const email = `test-student-${id.slice(0, 8)}-${n}@${TEST_STUDENT_EMAIL_DOMAIN}`;
      if (taken.has(email)) continue;
      rows.push({
        first_name: 'Test',
        last_name: `Student - ${label}${suffix}`,
        email,
        cohort_id: id,
        status: 'active',
        is_test: true,
        notes: `Test student created by ${user.email} via Add test student`,
      });
    }

    const { data, error } = await supabase.from('students').insert(rows).select('id, first_name, last_name, email, is_test');
    if (error) throw error;

    for (const s of data ?? []) {
      await createEnrollmentForNewStudent(supabase, { studentId: s.id, cohortId: id });
    }

    await logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'create',
      resourceType: 'student',
      resourceId: id,
      resourceDescription: `Added ${data?.length ?? 0} test student(s) to ${label}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, students: data });
  } catch (error) {
    console.error('Error adding test student:', error);
    return NextResponse.json({ success: false, error: 'Failed to add test student' }, { status: 500 });
  }
}
