import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

/**
 * GET  /api/lab-management/cohorts/[id]/graduate
 *   Preview: the cohort's remaining active students (what "Graduate cohort"
 *   would mark graduated). Read-only.
 *
 * POST /api/lab-management/cohorts/[id]/graduate
 *   Body: { end_date?: "YYYY-MM-DD" }   // defaults to today
 *   - cohorts.status   = 'graduated', cohorts.end_date = end_date
 *   - every student still status='active' in the cohort becomes
 *     status='graduated' with graduation_date = end_date (students already
 *     graduated or withdrawn keep their own dates / status)
 *   - matching student_program_enrollments rows closed, one
 *     student_cohort_history row per student (event_type 'graduation')
 *
 * Reversible: PATCH cohort status back to 'active' (the cohort list toggle) and
 * re-enroll individual students; the history rows name exactly who this
 * action touched (notes 'Cohort graduated <date>').
 *
 * Admin or above (this is a bulk status change on student records).
 */

async function getCallerRole(email: string | null | undefined) {
  if (!email) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('lab_users').select('role').ilike('email', email).single();
  return data?.role ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', id)
      .eq('status', 'active')
      .order('last_name');
    if (error) throw error;
    return NextResponse.json({ success: true, students: data ?? [] });
  } catch (error) {
    console.error('[cohort graduate GET] error', error);
    return NextResponse.json({ success: false, error: 'Failed to load students' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user, session } = auth;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const endDate: string =
      typeof body.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.end_date)
        ? body.end_date
        : new Date().toISOString().slice(0, 10);

    const { data: cohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select('id, cohort_number, status')
      .eq('id', id)
      .single();
    if (cohortErr || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }

    // Students first: if this fails nothing has changed and the cohort stays
    // as it was (a half-graduated cohort is the recoverable-but-confusing case,
    // so the cohort flag is written last).
    const { data: remaining, error: remErr } = await supabase
      .from('students')
      .select('id')
      .eq('cohort_id', id)
      .eq('status', 'active');
    if (remErr) throw remErr;
    const studentIds = (remaining ?? []).map(s => s.id as string);

    if (studentIds.length > 0) {
      const { error: upErr } = await supabase
        .from('students')
        .update({ status: 'graduated', graduation_date: endDate })
        .in('id', studentIds)
        .eq('status', 'active');
      if (upErr) throw upErr;

      const { error: enrollErr } = await supabase
        .from('student_program_enrollments')
        .update({ status: 'graduated', end_date: endDate, updated_at: new Date().toISOString() })
        .in('student_id', studentIds)
        .eq('status', 'active');
      if (enrollErr) console.error('[cohort graduate] enrollment close failed', enrollErr);

      const { error: histErr } = await supabase.from('student_cohort_history').insert(
        studentIds.map(studentId => ({
          student_id: studentId,
          from_cohort_id: id,
          to_cohort_id: id,
          previous_status: 'active',
          new_status: 'graduated',
          event_type: 'graduation',
          notes: `Cohort graduated ${endDate}`,
          transferred_by: user.email,
        }))
      );
      if (histErr) console.error('[cohort graduate] history insert failed', histErr);
    }

    const { error: cohortUpErr } = await supabase
      .from('cohorts')
      .update({ status: 'graduated', end_date: endDate })
      .eq('id', id);
    if (cohortUpErr) throw cohortUpErr;

    try {
      await logAuditEvent({
        user: { email: user.email, role: (await getCallerRole(session.user.email)) ?? 'admin' },
        action: 'update',
        resourceType: 'cohort',
        resourceId: id,
        resourceDescription: `Cohort ${cohort.cohort_number} graduated`,
        metadata: { end_date: endDate, students_graduated: studentIds.length },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true, end_date: endDate, students_graduated: studentIds.length });
  } catch (error) {
    console.error('[cohort graduate POST] error', error);
    return NextResponse.json({ success: false, error: 'Failed to graduate cohort' }, { status: 500 });
  }
}
