import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canManageStudentRoster } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/students/[id]/graduate
 *
 * Marks a student as graduated. Different from the cohort-transfer
 * flow because no cohort change happens — graduation is an end-state
 * within the student's current cohort.
 *
 * Side effects:
 *   - students.status        = 'graduated'
 *   - students.graduation_date = body.graduation_date (default today)
 *   - student_cohort_history row inserted with from = to = current
 *     cohort, new_status = 'graduated', so the audit trail picks up
 *     the lifecycle event alongside transfer / re-enrollment events.
 *
 * Permission: lead_instructor or above (matches /transfer).
 *
 * Body:
 *   {
 *     graduation_date?: "YYYY-MM-DD",   // defaults to today
 *     reason?: string,                  // free-form note for the audit row
 *     override_closeout?: boolean       // ignored for now (no closeout
 *                                         enforcement here yet — UI
 *                                         shows a soft warning instead)
 *   }
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
    const { graduation_date, reason } = body as {
      graduation_date?: string;
      reason?: string;
    };

    const today = new Date().toISOString().slice(0, 10);
    const gradDate = graduation_date || today;

    // Load current student.
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, cohort_id, status')
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.status === 'graduated') {
      return NextResponse.json(
        { error: 'Student is already graduated' },
        { status: 400 }
      );
    }

    // Update the student row.
    const { data: updated, error: upErr } = await supabase
      .from('students')
      .update({
        status: 'graduated',
        graduation_date: gradDate,
      })
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
      console.error('[graduate POST] update error', upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Audit row — to_cohort_id is the same as from_cohort_id since no
    // cohort change happens here. The new_status flip + reason capture
    // the lifecycle event. transferred_by stamps who marked it.
    if (student.cohort_id) {
      const { error: histErr } = await supabase
        .from('student_cohort_history')
        .insert({
          student_id: studentId,
          from_cohort_id: student.cohort_id,
          to_cohort_id: student.cohort_id,
          previous_status: student.status,
          new_status: 'graduated',
          reason:
            reason?.trim() ||
            `Graduated ${gradDate}`,
          transferred_by: user.email,
        });
      if (histErr) {
        console.error('[graduate POST] history insert failed', histErr);
      }
    }

    try {
      await logAuditEvent({
        user: { email: user.email, role: callerRole },
        action: 'student_group_changed',
        resourceType: 'student',
        resourceId: studentId,
        resourceDescription: `${student.first_name} ${student.last_name} graduated`,
        metadata: {
          previous_status: student.status,
          new_status: 'graduated',
          graduation_date: gradDate,
          reason: reason || null,
        },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (e) {
    console.error('[graduate POST] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
