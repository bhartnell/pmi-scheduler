import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canManageStudentRoster } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/students/[id]/withdraw
 *
 * Marks a student as withdrawn WITHOUT deleting anything. Mirrors
 * /graduate: no cohort change happens, the student's file (cohort_id,
 * labs, skills, clinical, team-lead records) stays intact and the
 * student is simply excluded from active-roster / completion-stat
 * views via status. Reversible via /re-enroll, which already handles
 * flipping a withdrawn student back to 'active'.
 *
 * Side effects:
 *   - students.status = 'withdrawn' (cohort_id untouched — preserved)
 *   - the student's active student_program_enrollments row is closed
 *     (status='withdrawn', end_date) so /re-enroll's insert of a fresh
 *     active row doesn't collide with one_active_enrollment_per_student
 *   - student_cohort_history row inserted with from = to = current
 *     cohort, event_type='withdrawal', so this shows up in the same
 *     audit trail as transfer / graduation / re-enrollment events
 *
 * Permission: lead_instructor or above (matches /graduate, /transfer,
 * /re-enroll) — separate from DELETE, which stays superadmin-only.
 *
 * Body: { reason?: string }
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

    const body = await request.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, cohort_id, status')
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.status === 'withdrawn') {
      return NextResponse.json(
        { error: 'Student is already withdrawn' },
        { status: 400 }
      );
    }

    // Update the student row. cohort_id is deliberately left untouched —
    // withdraw preserves the file, it never clears cohort/history data.
    const { data: updated, error: upErr } = await supabase
      .from('students')
      .update({ status: 'withdrawn' })
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
      console.error('[withdraw POST] update error', upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Close the active enrollment row (best-effort, same pattern as
    // /graduate) — frees up one_active_enrollment_per_student so a
    // later /re-enroll can insert a fresh active row.
    {
      const { error: enrollErr } = await supabase
        .from('student_program_enrollments')
        .update({
          status: 'withdrawn',
          end_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentId)
        .eq('status', 'active');
      if (enrollErr) {
        console.error('[withdraw POST] enrollment close failed', enrollErr);
      }
    }

    // Audit row — to_cohort_id mirrors from_cohort_id since no cohort
    // change happens here.
    if (student.cohort_id) {
      const { error: histErr } = await supabase
        .from('student_cohort_history')
        .insert({
          student_id: studentId,
          from_cohort_id: student.cohort_id,
          to_cohort_id: student.cohort_id,
          previous_status: student.status,
          new_status: 'withdrawn',
          event_type: 'withdrawal',
          notes: reason?.trim() || null,
          transferred_by: user.email,
        });
      if (histErr) {
        console.error('[withdraw POST] history insert failed', histErr);
      }
    }

    try {
      await logAuditEvent({
        user: { email: user.email, role: callerRole },
        action: 'student_group_changed',
        resourceType: 'student',
        resourceId: studentId,
        resourceDescription: `${student.first_name} ${student.last_name} withdrawn`,
        metadata: {
          event_type: 'withdrawal',
          previous_status: student.status,
          new_status: 'withdrawn',
          notes: reason || null,
        },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (e) {
    console.error('[withdraw POST] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
