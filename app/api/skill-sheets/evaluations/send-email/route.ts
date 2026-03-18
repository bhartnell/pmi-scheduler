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
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, is_critical)),
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
    console.log('[send-email] Evaluation:', evaluation_id, '| Student:', student?.first_name, student?.last_name, '| Email:', student?.email, '| Status:', evaluation.email_status);
    if (!student?.email) {
      console.error('[send-email] No email for student:', student?.first_name, student?.last_name);
      return NextResponse.json({ success: false, error: 'Student has no email address' }, { status: 400 });
    }

    const skillSheet = evaluation.skill_sheet as any;
    const evaluator = evaluation.evaluator as any;
    const labDay = evaluation.lab_day as any;

    // Calculate steps completed
    const totalSteps = skillSheet?.steps?.length || 0;
    const stepMarks = evaluation.step_marks as Record<string, string> | null;
    const passedSteps = stepMarks ? Object.values(stepMarks).filter(m => m === 'pass').length : 0;
    const criticalSteps = skillSheet?.steps?.filter((s: any) => s.is_critical) || [];
    const criticalPassed = stepMarks
      ? criticalSteps.filter((s: any) => stepMarks[String(s.step_number)] === 'pass').length
      : 0;

    // Format date
    const evalDate = labDay?.date
      ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Send email via Resend
    console.log('[send-email] Sending to:', student.email, '| Skill:', skillSheet?.skill_name, '| Type:', evaluation.evaluation_type);
    const emailResult = await sendSkillEvaluationEmail(student.email, {
      evaluationId: evaluation.id,
      studentFirstName: student.first_name,
      skillName: skillSheet?.skill_name || 'Skill Evaluation',
      evaluationType: evaluation.evaluation_type,
      result: evaluation.result,
      stepsCompleted: totalSteps > 0 ? `${passedSteps}/${totalSteps}` : undefined,
      criticalSteps: criticalSteps.length > 0 ? `${criticalPassed}/${criticalSteps.length}` : undefined,
      notes: evaluation.notes || undefined,
      evaluatorName: evaluator?.name ? formatInstructorName(evaluator.name) : 'Instructor',
      date: evalDate,
    });

    if (!emailResult.success) {
      console.error('[send-email] Resend failed:', emailResult.error);
      // Update status to failed so it can be retried
      await supabase
        .from('student_skill_evaluations')
        .update({ email_status: 'pending' })
        .eq('id', evaluation_id);
      return NextResponse.json({ success: false, error: emailResult.error || 'Failed to send email' }, { status: 500 });
    }

    console.log('[send-email] Success! Resend ID:', emailResult.id);
    // Update email_status to sent only after confirmed delivery
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
