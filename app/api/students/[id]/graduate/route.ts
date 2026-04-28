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

    // Phase 2 (2026-04-27): graduation now also closes the matching
    // student_program_enrollments row (status='graduated' + end_date)
    // and writes the history row with event_type='graduation'. The
    // /transfer + /re-enroll flows go through a single RPC; graduation
    // is its own path because no cohort change happens — we just
    // close the current enrollment and flip the student's status.
    //
    // Wrapped in best-effort try/catch around the secondary writes so
    // a failure on enrollment-row update or history insert doesn't
    // leave the students.status flip un-rolled-back. If we ever see
    // these in the wild they get logged and surfaced, but the primary
    // status change always lands.

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

    // Close the active enrollment row (Phase 2). Best-effort; if no
    // active row exists (legacy student missing the backfill), this
    // is a no-op.
    {
      const { error: enrollErr } = await supabase
        .from('student_program_enrollments')
        .update({
          status: 'graduated',
          end_date: gradDate,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentId)
        .eq('status', 'active');
      if (enrollErr) {
        console.error('[graduate POST] enrollment close failed', enrollErr);
      }
    }

    // Audit row — to_cohort_id is the same as from_cohort_id since no
    // cohort change happens here. event_type='graduation' tags the
    // lifecycle event for filtering / reporting.
    if (student.cohort_id) {
      const { error: histErr } = await supabase
        .from('student_cohort_history')
        .insert({
          student_id: studentId,
          from_cohort_id: student.cohort_id,
          to_cohort_id: student.cohort_id,
          previous_status: student.status,
          new_status: 'graduated',
          event_type: 'graduation',
          notes:
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
          event_type: 'graduation',
          previous_status: student.status,
          new_status: 'graduated',
          graduation_date: gradDate,
          notes: reason || null,
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
