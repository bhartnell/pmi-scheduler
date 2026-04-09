import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { validateVolunteerToken } from '@/lib/api-auth';
import type { VolunteerTokenResult } from '@/lib/api-auth';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let currentUser: { id: string; name: string; email: string; role: string } | null = null;
    let volunteerAuth: VolunteerTokenResult | null = null;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      // Fall back to volunteer token auth
      volunteerAuth = await validateVolunteerToken(request);
      if (!volunteerAuth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      currentUser = await getCurrentUser(session.user.email);
      if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const { id: skillSheetId } = await params;
    const body = await request.json();

    // For volunteer tokens, use a synthetic user reference
    // Volunteers should use /api/volunteer/lab-tokens/[token]/evaluate instead,
    // but if they reach this endpoint, we need a valid evaluator identity.
    const effectiveUser = currentUser || (volunteerAuth ? {
      id: volunteerAuth.tokenId,
      name: volunteerAuth.volunteerName,
      email: `volunteer-${volunteerAuth.tokenId}@volunteer.local`,
      role: 'volunteer',
    } : null);

    if (!effectiveUser) {
      return NextResponse.json({ success: false, error: 'No valid user context' }, { status: 401 });
    }

    const {
      student_id,
      lab_day_id,
      evaluation_type,
      result,
      notes,
      flagged_items,
      station_id,
      email_status,
      step_marks,
      status: evalStatus,
      critical_fail,
      critical_fail_notes,
      // Team evaluation fields
      team_members,
      // Retake fields
      is_retake,
      original_evaluation_id,
    } = body;

    // -----------------------------------------------
    // Team evaluation mode: batch-create for all team members
    // -----------------------------------------------
    if (Array.isArray(team_members) && team_members.length > 0) {
      return handleTeamEvaluation({
        skillSheetId,
        body,
        team_members,
        currentUser: effectiveUser,
      });
    }

    // -----------------------------------------------
    // Individual evaluation (existing logic)
    // -----------------------------------------------
    if (!student_id) {
      return NextResponse.json(
        { success: false, error: 'student_id is required' },
        { status: 400 }
      );
    }

    const validEvaluationTypes = ['formative', 'final_competency'];
    if (!evaluation_type || !validEvaluationTypes.includes(evaluation_type)) {
      return NextResponse.json(
        { success: false, error: 'evaluation_type must be "formative" or "final_competency"' },
        { status: 400 }
      );
    }

    // For in_progress saves, result defaults to 'pass' (provisional)
    const isInProgress = evalStatus === 'in_progress';

    const validResults = ['pass', 'fail', 'remediation'];
    if (!isInProgress && (!result || !validResults.includes(result))) {
      return NextResponse.json(
        { success: false, error: 'result must be "pass", "fail", or "remediation"' },
        { status: 400 }
      );
    }

    // If final_competency and not a pass, notes (remediation plan) is required (skip for in_progress)
    if (!isInProgress && evaluation_type === 'final_competency' && result !== 'pass' && !notes) {
      return NextResponse.json(
        { success: false, error: 'notes (remediation plan) are required when final_competency result is not "pass"' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the skill sheet exists
    const { data: sheet, error: sheetError } = await supabase
      .from('skill_sheets')
      .select('id, skill_name')
      .eq('id', skillSheetId)
      .single();

    if (sheetError) {
      if (sheetError.message?.includes('does not exist')) {
        return NextResponse.json(
          { success: false, error: 'Skill sheets table not available' },
          { status: 404 }
        );
      }
      if (sheetError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Skill sheet not found' },
          { status: 404 }
        );
      }
      throw sheetError;
    }

    // Determine attempt number for this student + skill sheet
    let attemptNumber = 1;
    try {
      const { data: prevEvals } = await supabase
        .from('student_skill_evaluations')
        .select('attempt_number')
        .eq('skill_sheet_id', skillSheetId)
        .eq('student_id', student_id)
        .order('attempt_number', { ascending: false })
        .limit(1);
      if (prevEvals && prevEvals.length > 0 && prevEvals[0].attempt_number) {
        attemptNumber = prevEvals[0].attempt_number + 1;
      }
    } catch {
      // attempt_number column may not exist yet — use default 1
    }

    // Determine email_status: final_competency always do_not_send, in_progress always pending
    const resolvedEmailStatus = isInProgress
      ? 'pending'
      : evaluation_type === 'final_competency'
        ? 'do_not_send'
        : (email_status && ['pending', 'sent', 'do_not_send', 'queued'].includes(email_status))
          ? email_status
          : 'pending';

    const resolvedResult = isInProgress ? (result || 'pass') : result;

    // For retakes, force attempt_number to 2 and validate original_evaluation_id
    const isRetake = is_retake === true;
    if (isRetake) {
      attemptNumber = 2;
    }

    // Create the evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .insert({
        skill_sheet_id: skillSheetId,
        student_id,
        lab_day_id: lab_day_id || null,
        evaluation_type,
        result: resolvedResult,
        evaluator_id: effectiveUser.id,
        notes: notes || null,
        flagged_items: flagged_items || null,
        email_status: resolvedEmailStatus,
        step_marks: step_marks || null,
        step_details: body.step_details || null,
        attempt_number: attemptNumber,
        status: isInProgress ? 'in_progress' : 'complete',
        critical_fail: critical_fail ?? false,
        critical_fail_notes: critical_fail_notes || null,
        is_retake: isRetake,
        original_evaluation_id: isRetake && original_evaluation_id ? original_evaluation_id : null,
      })
      .select('*')
      .single();

    if (evalError) {
      if (evalError.message?.includes('does not exist')) {
        return NextResponse.json(
          { success: false, error: 'Evaluations table not available' },
          { status: 500 }
        );
      }
      throw evalError;
    }

    // ---------------------------------------------------------------------------
    // Fix 2: Also create/update a station_completions record so the skill sheet
    // grade appears in the station grading view for this student.
    // ---------------------------------------------------------------------------
    if (station_id && student_id) {
      try {
        // Map skill sheet result to station_completions result
        const completionResult = result === 'pass' ? 'pass'
          : result === 'fail' ? 'incomplete'
          : 'needs_review'; // remediation → needs_review

        await supabase
          .from('station_completions')
          .upsert({
            student_id,
            station_id,
            result: completionResult,
            completed_at: new Date().toISOString(),
            logged_by: effectiveUser.id,
            lab_day_id: lab_day_id || null,
            notes: `Skill sheet: ${sheet?.skill_name || 'Unknown'} — ${evaluation_type} ${result}${notes ? '. ' + notes : ''}`,
          }, { onConflict: 'student_id,station_id,lab_day_id' })
          .select('id')
          .single();
        // Ignore errors — station_completions upsert is best-effort
      } catch {
        // Non-critical: don't fail the evaluation if the station completion link fails
        console.warn('Failed to upsert station_completions for skill sheet evaluation');
      }
    }

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error('Error creating skill evaluation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create skill evaluation' },
      { status: 500 }
    );
  }
}

// ─── Team Evaluation Handler ──────────────────────────────────────────────────

interface TeamMember {
  student_id: string;
  student_name: string;
  team_role: 'leader' | 'assistant';
}

async function handleTeamEvaluation({
  skillSheetId,
  body,
  team_members,
  currentUser,
}: {
  skillSheetId: string;
  body: Record<string, unknown>;
  team_members: TeamMember[];
  currentUser: { id: string; name: string; email: string; role: string };
}) {
  const supabase = getSupabaseAdmin();

  const {
    lab_day_id,
    evaluation_type,
    result,
    notes,
    flagged_items,
    station_id,
    email_status,
    step_marks,
    step_details,
    status: evalStatus,
    critical_fail,
    critical_fail_notes,
  } = body as Record<string, unknown>;

  // Validate
  const validEvaluationTypes = ['formative', 'final_competency'];
  if (!evaluation_type || !validEvaluationTypes.includes(evaluation_type as string)) {
    return NextResponse.json(
      { success: false, error: 'evaluation_type must be "formative" or "final_competency"' },
      { status: 400 }
    );
  }

  const isInProgress = evalStatus === 'in_progress';
  const validResults = ['pass', 'fail', 'remediation'];
  if (!isInProgress && (!result || !validResults.includes(result as string))) {
    return NextResponse.json(
      { success: false, error: 'result must be "pass", "fail", or "remediation"' },
      { status: 400 }
    );
  }

  // Verify skill sheet
  const { data: sheet, error: sheetError } = await supabase
    .from('skill_sheets')
    .select('id, skill_name')
    .eq('id', skillSheetId)
    .single();

  if (sheetError) {
    if (sheetError.code === 'PGRST116') {
      return NextResponse.json({ success: false, error: 'Skill sheet not found' }, { status: 404 });
    }
    throw sheetError;
  }

  // Find the leader
  const leader = team_members.find(m => m.team_role === 'leader');
  if (!leader) {
    return NextResponse.json(
      { success: false, error: 'Team must have exactly one leader' },
      { status: 400 }
    );
  }

  const resolvedEmailStatus = isInProgress
    ? 'pending'
    : evaluation_type === 'final_competency'
      ? 'do_not_send'
      : (email_status && ['pending', 'sent', 'do_not_send', 'queued'].includes(email_status as string))
        ? email_status
        : 'pending';

  const resolvedResult = isInProgress ? ((result as string) || 'pass') : result;

  const evaluations: Array<Record<string, unknown>> = [];

  // 1. Create the leader's evaluation first
  let leaderAttemptNumber = 1;
  try {
    const { data: prevEvals } = await supabase
      .from('student_skill_evaluations')
      .select('attempt_number')
      .eq('skill_sheet_id', skillSheetId)
      .eq('student_id', leader.student_id)
      .order('attempt_number', { ascending: false })
      .limit(1);
    if (prevEvals && prevEvals.length > 0 && prevEvals[0].attempt_number) {
      leaderAttemptNumber = prevEvals[0].attempt_number + 1;
    }
  } catch {
    // ignore
  }

  const { data: leaderEval, error: leaderError } = await supabase
    .from('student_skill_evaluations')
    .insert({
      skill_sheet_id: skillSheetId,
      student_id: leader.student_id,
      lab_day_id: (lab_day_id as string) || null,
      evaluation_type,
      result: resolvedResult,
      evaluator_id: currentUser.id,
      notes: (notes as string) || null,
      flagged_items: flagged_items || null,
      email_status: resolvedEmailStatus,
      step_marks: step_marks || null,
      step_details: step_details || null,
      attempt_number: leaderAttemptNumber,
      status: isInProgress ? 'in_progress' : 'complete',
      team_role: 'leader',
      team_evaluation_id: null, // leader has no parent
      critical_fail: (critical_fail as boolean) ?? false,
      critical_fail_notes: (critical_fail_notes as string) || null,
    })
    .select('*')
    .single();

  if (leaderError) {
    throw leaderError;
  }

  evaluations.push({ ...leaderEval, student_name: leader.student_name });

  // 2. Create assistant evaluations referencing the leader
  const assistants = team_members.filter(m => m.team_role === 'assistant');

  for (const assistant of assistants) {
    let assistantAttempt = 1;
    try {
      const { data: prevEvals } = await supabase
        .from('student_skill_evaluations')
        .select('attempt_number')
        .eq('skill_sheet_id', skillSheetId)
        .eq('student_id', assistant.student_id)
        .order('attempt_number', { ascending: false })
        .limit(1);
      if (prevEvals && prevEvals.length > 0 && prevEvals[0].attempt_number) {
        assistantAttempt = prevEvals[0].attempt_number + 1;
      }
    } catch {
      // ignore
    }

    const { data: assistantEval, error: assistantError } = await supabase
      .from('student_skill_evaluations')
      .insert({
        skill_sheet_id: skillSheetId,
        student_id: assistant.student_id,
        lab_day_id: (lab_day_id as string) || null,
        evaluation_type,
        result: resolvedResult,
        evaluator_id: currentUser.id,
        notes: (notes as string) || null,
        flagged_items: flagged_items || null,
        email_status: resolvedEmailStatus,
        step_marks: step_marks || null,
        step_details: step_details || null,
        attempt_number: assistantAttempt,
        status: isInProgress ? 'in_progress' : 'complete',
        team_role: 'assistant',
        team_evaluation_id: leaderEval.id,
        critical_fail: (critical_fail as boolean) ?? false,
        critical_fail_notes: (critical_fail_notes as string) || null,
      })
      .select('*')
      .single();

    if (assistantError) {
      console.error(`Failed to create assistant evaluation for ${assistant.student_id}:`, assistantError);
      continue; // Don't fail the whole batch
    }

    evaluations.push({ ...assistantEval, student_name: assistant.student_name });
  }

  // 3. Station completions for all team members (best-effort)
  if (station_id) {
    for (const member of team_members) {
      try {
        const completionResult = (result as string) === 'pass' ? 'pass'
          : (result as string) === 'fail' ? 'incomplete'
          : 'needs_review';

        await supabase
          .from('station_completions')
          .upsert({
            student_id: member.student_id,
            station_id,
            result: completionResult,
            completed_at: new Date().toISOString(),
            logged_by: currentUser.id,
            lab_day_id: (lab_day_id as string) || null,
            notes: `Team skill sheet: ${sheet?.skill_name || 'Unknown'} — ${evaluation_type} ${result} (${member.team_role})`,
          }, { onConflict: 'student_id,station_id,lab_day_id' })
          .select('id')
          .single();
      } catch {
        console.warn(`Failed to upsert station_completions for team member ${member.student_id}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    team: true,
    evaluations,
    leader_evaluation_id: leaderEval.id,
  });
}
