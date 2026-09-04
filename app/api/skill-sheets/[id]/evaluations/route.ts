import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, canEditScoreSheets } from '@/lib/permissions';
import { validateVolunteerToken } from '@/lib/api-auth';
import { logEvaluationEdit } from '@/lib/audit';

// GET /api/skill-sheets/[id]/evaluations?student_id=UUID
// Returns all evaluations for a specific student + skill sheet, ordered by attempt_number desc
// Supports volunteer lab tokens for read-only access
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      // Fall back to volunteer token auth
      const volunteerAuth = await validateVolunteerToken(request);
      if (!volunteerAuth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      // Volunteer token is valid — proceed (read-only access)
    } else {
      const { data: currentUser } = await supabase
        .from('lab_users')
        .select('id, role')
        .ilike('email', session.user.email)
        .single();

      if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const { id: skillSheetId } = await params;
    const studentId = request.nextUrl.searchParams.get('student_id');
    if (!studentId) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }

    const { data: evaluations, error } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id,
        evaluation_type,
        result,
        notes,
        flagged_items,
        step_marks,
        step_details,
        email_status,
        status,
        attempt_number,
        created_at,
        critical_fail,
        critical_fail_notes,
        edited_by,
        edited_at,
        edit_reason,
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        edited_by_user:lab_users!student_skill_evaluations_edited_by_fkey(id, name)
      `)
      .eq('skill_sheet_id', skillSheetId)
      .eq('student_id', studentId)
      .order('attempt_number', { ascending: false });

    if (error) {
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, evaluations: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, evaluations: evaluations || [] });
  } catch (err) {
    console.error('Error fetching student evaluations:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
  }
}

// DELETE /api/skill-sheets/[id]/evaluations?evaluation_id=UUID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // params.id not used for delete — we use evaluation_id directly
    await params;

    const evaluationId = request.nextUrl.searchParams.get('evaluation_id');
    if (!evaluationId) {
      return NextResponse.json({ success: false, error: 'evaluation_id is required' }, { status: 400 });
    }

    // Clear FK references in lab_day_student_queue before deleting the evaluation
    await supabase
      .from('lab_day_student_queue')
      .update({ evaluation_id: null })
      .eq('evaluation_id', evaluationId);

    // Clear self-referencing team_evaluation_id FK before deleting
    await supabase
      .from('student_skill_evaluations')
      .update({ team_evaluation_id: null })
      .eq('team_evaluation_id', evaluationId);

    // IMPORTANT: student_skill_evaluations has a prevent_critical_delete
    // trigger (see migrations/archive/20260315_fk_cascade_audit_and_delete_protection.sql)
    // that blocks any direct DELETE with P0001 unless the session var
    // app.allow_critical_delete = 'true'. A plain supabase.delete() does
    // NOT get past this trigger, even via the service role — it broke
    // the "retest skill" flow mid-lab on NREMT day (2026-04-15).
    //
    // Use the delete_evaluation_admin(uuid) SECURITY DEFINER RPC added in
    // 20260415_delete_evaluation_admin.sql. It sets the override flag
    // transaction-locally and performs the delete in a single call.
    const { error } = await supabase.rpc('delete_evaluation_admin', {
      p_evaluation_id: evaluationId,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting evaluation:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete evaluation' }, { status: 500 });
  }
}

// PATCH /api/skill-sheets/[id]/evaluations
// Body: { evaluation_id, step_marks?, critical_fail?, critical_fail_notes?, result?, edit_reason? }
//
// Director-level score-sheet correction: updates an already-submitted
// evaluation IN PLACE (as opposed to POST /evaluate, which always inserts a
// new attempt row). Gated to a narrow email allowlist — canEditScoreSheets —
// per Ben's ticket (not role-based; see lib/permissions.ts).
//
// This is a plain UPDATE. It does NOT touch/bypass the prevent_critical_delete
// trigger used by DELETE above — that trigger only fires on DELETE, so a
// service-role UPDATE here needs no special RPC.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (!canEditScoreSheets(currentUser.email)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // params.id not used for the update — evaluation_id in the body identifies the row
    await params;

    const body = await request.json();
    const {
      evaluation_id: evaluationId,
      step_marks,
      critical_fail,
      critical_fail_notes,
      result,
      edit_reason,
    } = body;

    if (!evaluationId) {
      return NextResponse.json({ success: false, error: 'evaluation_id is required' }, { status: 400 });
    }

    const validResults = ['pass', 'fail', 'remediation'];
    if (result !== undefined && !validResults.includes(result)) {
      return NextResponse.json({ success: false, error: 'Invalid result value' }, { status: 400 });
    }

    // Fetch the current row first — both to confirm it exists and to build
    // a before/after diff for the audit log (Data Integrity Operating Rules:
    // diagnose from real data, not guesses).
    const { data: existing, error: fetchError } = await supabase
      .from('student_skill_evaluations')
      .select('id, student_id, result, critical_fail, critical_fail_notes')
      .eq('id', evaluationId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      edited_by: currentUser.id,
      edited_at: new Date().toISOString(),
      edit_reason: edit_reason || null,
    };
    if (step_marks !== undefined) updatePayload.step_marks = step_marks;
    if (critical_fail !== undefined) updatePayload.critical_fail = critical_fail;
    if (critical_fail_notes !== undefined) updatePayload.critical_fail_notes = critical_fail_notes;
    if (result !== undefined) updatePayload.result = result;

    const { data: updated, error: updateError } = await supabase
      .from('student_skill_evaluations')
      .update(updatePayload)
      .eq('id', evaluationId)
      .select(`
        id,
        evaluation_type,
        result,
        notes,
        flagged_items,
        step_marks,
        step_details,
        email_status,
        status,
        attempt_number,
        created_at,
        critical_fail,
        critical_fail_notes,
        edited_by,
        edited_at,
        edit_reason,
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        edited_by_user:lab_users!student_skill_evaluations_edited_by_fkey(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    await logEvaluationEdit(
      { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      evaluationId,
      `Corrected score sheet for student ${existing.student_id}`,
      {
        before: { result: existing.result, critical_fail: existing.critical_fail, critical_fail_notes: existing.critical_fail_notes },
        after: { result: updated.result, critical_fail: updated.critical_fail, critical_fail_notes: updated.critical_fail_notes },
        edit_reason: edit_reason || null,
      }
    );

    return NextResponse.json({ success: true, evaluation: updated });
  } catch (err) {
    console.error('Error correcting evaluation:', err);
    return NextResponse.json({ success: false, error: 'Failed to correct evaluation' }, { status: 500 });
  }
}
