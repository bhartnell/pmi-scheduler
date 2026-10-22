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
        event_type, from_cert_level, to_cert_level,
        notes, transferred_by, transferred_at,
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
//
// Body: { target_cohort_id, new_status?, notes? }
//   `reason` is still accepted as a synonym for `notes` for back-compat
//   with any callers from before the Phase 2 rename.
//
// Phase 2 (2026-04-27): now dispatches through the
// promote_student_to_program RPC which mutates student_program_enrollments,
// updates students, and inserts the student_cohort_history row in one
// transaction. event_type is computed here based on whether the move
// crosses program boundaries:
//   • same program → 'transfer'
//   • different program → 'program_upgrade'
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
        { error: 'Forbidden - lead instructor or above required' },
        { status: 403 }
      );
    }

    const { id: studentId } = await params;
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const {
      target_cohort_id,
      new_status,
      notes,
      reason, // back-compat alias
    } = body as {
      target_cohort_id: string;
      new_status?: 'active' | 'withdrawn' | 'on_hold' | 'graduated' | null;
      notes?: string;
      reason?: string;
    };

    if (!target_cohort_id) {
      return NextResponse.json(
        { error: 'target_cohort_id required' },
        { status: 400 }
      );
    }

    // Load current student + program (for event_type classification).
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

    if (student.cohort_id === target_cohort_id) {
      return NextResponse.json(
        { error: 'Student is already in this cohort' },
        { status: 400 }
      );
    }

    // Validate target cohort + pull its program for event_type decision.
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

    // Same-program vs cross-program decision drives event_type.
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
    const event_type = fromProgram === toProgram ? 'transfer' : 'program_upgrade';

    // RPC handles the four writes atomically.
    const { error: rpcErr } = await supabase.rpc('promote_student_to_program', {
      p_student_id: studentId,
      p_target_cohort_id: target_cohort_id,
      p_event_type: event_type,
      p_transferred_by: user.email,
      p_notes: (notes ?? reason)?.trim() || null,
      p_new_status: new_status || 'active',
    });

    if (rpcErr) {
      console.error('[transfer POST] RPC error', rpcErr);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    // Refetch the updated student row for the client (RPC returns a
    // jsonb summary, not the full row).
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
        resourceDescription: `${student.first_name} ${student.last_name} cohort ${event_type}`,
        metadata: {
          event_type,
          from_cohort_id: student.cohort_id,
          to_cohort_id: target_cohort_id,
          from_program: fromProgram,
          to_program: toProgram,
          previous_status: student.status,
          new_status: new_status ?? student.status,
          notes: (notes ?? reason) || null,
        },
      });
    } catch {
      // Audit logging is best-effort; don't fail the transfer on it.
    }

    return NextResponse.json({
      success: true,
      student: updated,
      event_type,
    });
  } catch (e) {
    console.error('[transfer POST] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
