import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/volunteer/lab-tokens/[token]/evaluate — volunteer submits a grade (no auth)
// Token-based authentication: validates token instead of session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    // 1. Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('volunteer_lab_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired access link' },
        { status: 401 }
      );
    }

    const now = new Date();
    if (
      !tokenData.is_active ||
      now < new Date(tokenData.valid_from) ||
      now > new Date(tokenData.valid_until)
    ) {
      return NextResponse.json(
        { success: false, error: 'Access link is expired or revoked' },
        { status: 403 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const {
      skill_sheet_id,
      student_id,
      evaluation_type,
      result,
      notes,
      flagged_items,
      station_id,
      step_marks,
      step_details,
    } = body;

    if (!skill_sheet_id || !student_id) {
      return NextResponse.json(
        { success: false, error: 'skill_sheet_id and student_id are required' },
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

    // NREMT KILL SWITCH — same guard as the main /api/skill-sheets/[id]/evaluate
    // route. Volunteers land here via token URL; the client page defaults to
    // 'formative', so on NREMT days we must coerce server-side. Fails OPEN
    // on DB error so submits still go through on network blips.
    let effectiveEvaluationType: 'formative' | 'final_competency' = evaluation_type;
    if (tokenData.lab_day_id) {
      try {
        const { data: labDayRow } = await supabase
          .from('lab_days')
          .select('is_nremt_testing')
          .eq('id', tokenData.lab_day_id)
          .single();
        if (labDayRow?.is_nremt_testing && effectiveEvaluationType !== 'final_competency') {
          console.warn(
            `[volunteer evaluate guard] NREMT testing active for lab_day ${tokenData.lab_day_id} — coerced evaluation_type from '${effectiveEvaluationType}' to 'final_competency'`
          );
          effectiveEvaluationType = 'final_competency';
        }
      } catch (e) {
        console.warn('[volunteer evaluate guard] failed to check is_nremt_testing:', e);
      }
    }

    const validResults = ['pass', 'fail', 'remediation'];
    if (!result || !validResults.includes(result)) {
      return NextResponse.json(
        { success: false, error: 'result must be "pass", "fail", or "remediation"' },
        { status: 400 }
      );
    }

    // 3. Verify the skill sheet exists
    const { data: sheet, error: sheetError } = await supabase
      .from('skill_sheets')
      .select('id, skill_name')
      .eq('id', skill_sheet_id)
      .single();

    if (sheetError || !sheet) {
      return NextResponse.json(
        { success: false, error: 'Skill sheet not found' },
        { status: 404 }
      );
    }

    // 4. Determine attempt number
    let attemptNumber = 1;
    try {
      const { data: prevEvals } = await supabase
        .from('student_skill_evaluations')
        .select('attempt_number')
        .eq('skill_sheet_id', skill_sheet_id)
        .eq('student_id', student_id)
        .order('attempt_number', { ascending: false })
        .limit(1);
      if (prevEvals && prevEvals.length > 0 && prevEvals[0].attempt_number) {
        attemptNumber = prevEvals[0].attempt_number + 1;
      }
    } catch {
      // attempt_number column may not exist
    }

    // 5. Create evaluation with evaluator_type = 'volunteer'
    // evaluator_id is null since volunteer is not a lab_user
    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .insert({
        skill_sheet_id,
        student_id,
        lab_day_id: tokenData.lab_day_id,
        evaluation_type: effectiveEvaluationType,
        result,
        evaluator_id: null,
        evaluator_type: 'volunteer',
        notes: notes
          ? `[Volunteer: ${tokenData.volunteer_name}] ${notes}`
          : `[Volunteer: ${tokenData.volunteer_name}]`,
        flagged_items: flagged_items || null,
        email_status: 'do_not_send',
        step_marks: step_marks || null,
        step_details: step_details || null,
        attempt_number: attemptNumber,
        status: 'complete',
      })
      .select('*')
      .single();

    if (evalError) {
      console.error('Volunteer evaluation insert error:', evalError);
      throw evalError;
    }

    // 6. Also upsert station_completions (best-effort)
    if (station_id && student_id) {
      try {
        const completionResult =
          result === 'pass'
            ? 'pass'
            : result === 'fail'
              ? 'incomplete'
              : 'needs_review';

        await supabase
          .from('station_completions')
          .upsert(
            {
              student_id,
              station_id,
              result: completionResult,
              completed_at: new Date().toISOString(),
              logged_by: null,
              lab_day_id: tokenData.lab_day_id,
              notes: `Volunteer (${tokenData.volunteer_name}): ${sheet.skill_name} — ${effectiveEvaluationType} ${result}`,
            },
            { onConflict: 'student_id,station_id,lab_day_id' }
          )
          .select('id')
          .single();
      } catch {
        // Non-critical
        console.warn('Failed to upsert station_completions for volunteer evaluation');
      }
    }

    return NextResponse.json({ success: true, evaluation });
  } catch (err: unknown) {
    console.error('Volunteer evaluation error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
