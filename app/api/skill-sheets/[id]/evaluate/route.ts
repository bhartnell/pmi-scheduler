import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id: skillSheetId } = await params;
    const body = await request.json();

    const {
      student_id,
      lab_day_id,
      evaluation_type,
      result,
      notes,
      flagged_items,
    } = body;

    // -----------------------------------------------
    // Validation
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

    const validResults = ['pass', 'fail', 'remediation'];
    if (!result || !validResults.includes(result)) {
      return NextResponse.json(
        { success: false, error: 'result must be "pass", "fail", or "remediation"' },
        { status: 400 }
      );
    }

    // If final_competency and not a pass, notes (remediation plan) is required
    if (evaluation_type === 'final_competency' && result !== 'pass' && !notes) {
      return NextResponse.json(
        { success: false, error: 'notes (remediation plan) are required when final_competency result is not "pass"' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the skill sheet exists
    const { data: sheet, error: sheetError } = await supabase
      .from('skill_sheets')
      .select('id')
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

    // Create the evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .insert({
        skill_sheet_id: skillSheetId,
        student_id,
        lab_day_id: lab_day_id || null,
        evaluation_type,
        result,
        evaluator_id: currentUser.id,
        notes: notes || null,
        flagged_items: flagged_items || null,
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

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error('Error creating skill evaluation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create skill evaluation' },
      { status: 500 }
    );
  }
}
