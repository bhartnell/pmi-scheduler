import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { sendSkillEvaluationEmail } from '@/lib/email';

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify instructor role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, name, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { evaluation_id } = await request.json();

    if (!evaluation_id) {
      return NextResponse.json({ success: false, error: 'evaluation_id is required' }, { status: 400 });
    }

    // Fetch evaluation with related data
    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, flagged_items, step_marks, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, is_critical, possible_points, sub_items)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('id', evaluation_id)
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
    }

    // Check email_status
    if (evaluation.email_status === 'do_not_send') {
      return NextResponse.json({ success: false, error: 'This evaluation is marked do_not_send' }, { status: 400 });
    }
    if (evaluation.email_status === 'sent') {
      return NextResponse.json({ success: false, error: 'Email already sent for this evaluation' }, { status: 400 });
    }

    const student = evaluation.student as any;
    if (!student?.email) {
      console.warn('[send-email] No email on file for student:', student?.first_name, student?.last_name);
      // Mark as skipped so it doesn't block batch sends
      await supabase
        .from('student_skill_evaluations')
        .update({ email_status: 'do_not_send' })
        .eq('id', evaluation_id);
      return NextResponse.json({
        success: false,
        error: `Email not on file for ${student?.first_name || ''} ${student?.last_name || 'this student'}`.trim(),
        no_email: true,
      }, { status: 200 });
    }

    const skillSheet = evaluation.skill_sheet as any;
    const evaluator = evaluation.evaluator as any;
    const labDay = evaluation.lab_day as any;

    // Calculate steps completed - handle both old (string) and new (object) step_marks formats
    const totalSteps = skillSheet?.steps?.length || 0;
    const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
    const stepsArr = skillSheet?.steps || [];
    const isMultiPoint = stepsArr.some((s: any) => (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0));
    const totalPossiblePoints = stepsArr.reduce((sum: number, s: any) => sum + (s.possible_points || 1), 0);

    let passedSteps = 0;
    let earnedPoints = 0;
    const criticalSteps = stepsArr.filter((s: any) => s.is_critical);
    let criticalPassed = 0;

    for (const [key, val] of Object.entries(rawMarks)) {
      if (typeof val === 'string') {
        const step = stepsArr.find((s: any) => String(s.step_number) === key);
        if (val === 'pass') { passedSteps++; earnedPoints += step?.possible_points || 1; }
        if (step?.is_critical && val === 'pass') criticalPassed++;
      } else if (typeof val === 'object' && val !== null) {
        const obj = val as { completed?: boolean; points?: number };
        earnedPoints += obj.points || 0;
        if (obj.completed) passedSteps++;
        const step = stepsArr.find((s: any) => String(s.step_number) === key);
        if (step?.is_critical && obj.completed) criticalPassed++;
      }
    }

    // Format date
    const evalDate = labDay?.date
      ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Send email
    const emailResult = await sendSkillEvaluationEmail(student.email, {
      evaluationId: evaluation.id,
      studentFirstName: student.first_name,
      skillName: skillSheet?.skill_name || 'Skill Evaluation',
      evaluationType: evaluation.evaluation_type,
      result: evaluation.result,
      stepsCompleted: isMultiPoint
        ? `${earnedPoints}/${totalPossiblePoints} points (${totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0}%)`
        : (totalSteps > 0 ? `${passedSteps}/${totalSteps}` : undefined),
      criticalSteps: criticalSteps.length > 0 ? `${criticalPassed}/${criticalSteps.length}` : undefined,
      notes: evaluation.notes || undefined,
      evaluatorName: evaluator?.name ? formatInstructorName(evaluator.name) : 'Instructor',
      date: evalDate,
    });

    if (!emailResult.success) {
      return NextResponse.json({ success: false, error: emailResult.error || 'Failed to send email' }, { status: 500 });
    }

    // Update email_status to sent
    await supabase
      .from('student_skill_evaluations')
      .update({ email_status: 'sent' })
      .eq('id', evaluation_id);

    return NextResponse.json({ success: true, emailId: emailResult.id });
  } catch (error) {
    console.error('Error sending skill evaluation email:', error);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
