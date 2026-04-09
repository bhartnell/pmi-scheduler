import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { validateVolunteerToken } from '@/lib/api-auth';

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
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name)
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

    const { error } = await supabase
      .from('student_skill_evaluations')
      .delete()
      .eq('id', evaluationId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting evaluation:', err);
    return NextResponse.json({ success: false, error: 'Failed to delete evaluation' }, { status: 500 });
  }
}
