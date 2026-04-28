import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canManageStudentRoster } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/students/[id]/re-enroll
 *
 * Returns a non-active student (withdrawn / graduated / on_hold) to
 * 'active' status by enrolling them in a target cohort. Server-side
 * decides whether the action is a re-enrollment or a program upgrade
 * based on whether the target cohort's program matches the student's
 * current cohort program:
 *
 *   • same program       → event_type = 're-enrollment'
 *   • different program  → event_type = 'program_upgrade'  (and stamps
 *                          from_cert_level / to_cert_level on the row)
 *
 * Both paths dispatch through promote_student_to_program (Phase 2 RPC)
 * which handles the four writes — student_program_enrollments insert,
 * students.status flip, student_cohort_history row — atomically.
 *
 * Body:
 *   { target_cohort_id: string,
 *     notes?: string,        // free-form audit note
 *     reason?: string }      // back-compat alias for notes
 *
 * Permission: lead_instructor or above. Same gate as /transfer + /graduate.
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
    const { target_cohort_id, notes, reason } = body as {
      target_cohort_id: string;
      notes?: string;
      reason?: string;
    };

    if (!target_cohort_id) {
      return NextResponse.json(
        { error: 'target_cohort_id required' },
        { status: 400 }
      );
    }

    // Load student + current program (for event_type classification).
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select(`
        id, first_name, last_name, cohort_id, status,
        cohort:cohorts!students_cohort_id_fkey(
          id,
          program:programs(abbreviation)
        )
      `)
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.status === 'active') {
      return NextResponse.json(
        {
          error:
            'Student is already active. Use /transfer to move an active student to a different cohort.',
        },
        { status: 400 }
      );
    }

    // Lookup target cohort + its program.
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

    // Program comparison drives event_type.
    type ProgramHolder = { abbreviation?: string | null } | null | undefined;
    const programOf = (p: ProgramHolder) =>
      (p?.abbreviation === 'PM' || p?.abbreviation === 'PMD')
        ? 'paramedic'
        : (p?.abbreviation || '').toLowerCase() || null;
    const fromProgram = programOf(
      (student.cohort as unknown as { program: ProgramHolder })?.program
    );
    const toProgram = programOf(
      (targetCohort.program as unknown as ProgramHolder)
    );
    const event_type =
      fromProgram && toProgram && fromProgram !== toProgram
        ? 'program_upgrade'
        : 're-enrollment';

    // Atomic write via the RPC.
    const { error: rpcErr } = await supabase.rpc('promote_student_to_program', {
      p_student_id: studentId,
      p_target_cohort_id: target_cohort_id,
      p_event_type: event_type,
      p_transferred_by: user.email,
      p_notes: (notes ?? reason)?.trim() || null,
      p_new_status: 'active',
    });

    if (rpcErr) {
      console.error('[re-enroll POST] RPC error', rpcErr);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    const { data: updated } = await supabase
      .from('students')
      .select(`
        *,
        cohort:cohorts!students_cohort_id_fkey(
          id, cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', studentId)
      .single();

    try {
      await logAuditEvent({
        user: { email: user.email, role: callerRole },
        action: 'student_group_changed',
        resourceType: 'student',
        resourceId: studentId,
        resourceDescription: `${student.first_name} ${student.last_name} ${event_type}`,
        metadata: {
          event_type,
          from_cohort_id: student.cohort_id,
          to_cohort_id: target_cohort_id,
          from_program: fromProgram,
          to_program: toProgram,
          previous_status: student.status,
          new_status: 'active',
          notes: (notes ?? reason) || null,
        },
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({
      success: true,
      student: updated,
      event_type,
    });
  } catch (e) {
    console.error('[re-enroll POST] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
