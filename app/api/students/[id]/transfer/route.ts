import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canManageStudentRoster } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

/**
 * /api/students/[id]/transfer
 *
 * Cohort transfers with an audit trail.
 * - POST moves the student to a new cohort, optionally updates their status,
 *   and writes a row to student_cohort_history.
 * - GET returns the transfer history for the student.
 *
 * Permission: lead_instructor or above (same gate as the rest of roster
 * management via canManageStudentRoster).
 */

async function getCallerRole(email: string | null | undefined) {
  if (!email) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

// ---------------------------------------------------------------------------
// GET — history for this student
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: studentId } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('student_cohort_history')
      .select(`
        id, from_cohort_id, to_cohort_id, previous_status, new_status,
        reason, transferred_by, transferred_at,
        from_cohort:cohorts!student_cohort_history_from_cohort_id_fkey(
          id, cohort_number, program:programs(abbreviation)
        ),
        to_cohort:cohorts!student_cohort_history_to_cohort_id_fkey(
          id, cohort_number, program:programs(abbreviation)
        )
      `)
      .eq('student_id', studentId)
      .order('transferred_at', { ascending: false });

    if (error) {
      console.error('[transfer GET] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, history: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — transfer
//   body: { target_cohort_id, new_status?, reason? }
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const callerRole = await getCallerRole(session.user.email);
    if (!callerRole || !canManageStudentRoster(callerRole)) {
      return NextResponse.json(
        { error: 'Forbidden — lead instructor or above required' },
        { status: 403 }
      );
    }

    const { id: studentId } = await params;
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const {
      target_cohort_id,
      new_status,
      reason,
    } = body as {
      target_cohort_id: string;
      new_status?: 'active' | 'withdrawn' | 'on_hold' | 'graduated' | null;
      reason?: string;
    };

    if (!target_cohort_id) {
      return NextResponse.json(
        { error: 'target_cohort_id required' },
        { status: 400 }
      );
    }

    // Load current student + cohort
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, cohort_id, status')
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.cohort_id === target_cohort_id) {
      return NextResponse.json(
        { error: 'Student is already in this cohort' },
        { status: 400 }
      );
    }

    // Validate target cohort exists
    const { data: targetCohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select('id, cohort_number, program:programs(abbreviation, name)')
      .eq('id', target_cohort_id)
      .single();

    if (cohortErr || !targetCohort) {
      return NextResponse.json(
        { error: 'Target cohort not found' },
        { status: 404 }
      );
    }

    // Build update. Status only changes if explicitly provided.
    const update: Record<string, unknown> = { cohort_id: target_cohort_id };
    if (new_status) update.status = new_status;

    const { data: updated, error: upErr } = await supabase
      .from('students')
      .update(update)
      .eq('id', studentId)
      .select(`
        *,
        cohort:cohorts!students_cohort_id_fkey(
          id, cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .single();

    if (upErr) {
      console.error('[transfer POST] update error', upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Write history row. This is fire-and-log — if it fails we still
    // completed the move, but we surface the problem so it can be
    // reconciled manually rather than silently losing the audit trail.
    const { error: histErr } = await supabase
      .from('student_cohort_history')
      .insert({
        student_id: studentId,
        from_cohort_id: student.cohort_id,
        to_cohort_id: target_cohort_id,
        previous_status: student.status,
        new_status: new_status ?? student.status,
        reason: reason?.trim() || null,
        transferred_by: user.email,
      });

    if (histErr) {
      console.error('[transfer POST] history insert failed', histErr);
    }

    try {
      await logAuditEvent({
        user: { email: user.email, role: callerRole },
        action: 'student_group_changed',
        resourceType: 'student',
        resourceId: studentId,
        resourceDescription: `${student.first_name} ${student.last_name} cohort transfer`,
        metadata: {
          from_cohort_id: student.cohort_id,
          to_cohort_id: target_cohort_id,
          previous_status: student.status,
          new_status: new_status ?? student.status,
          reason: reason || null,
        },
      });
    } catch {
      // Audit logging is best-effort; don't fail the transfer on it.
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (e) {
    console.error('[transfer POST] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
