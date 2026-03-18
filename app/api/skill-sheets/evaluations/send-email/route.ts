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

    // Fetch evaluation with related data (include step instruction + phase for full score sheet)
    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, flagged_items, step_marks, step_details, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, phase, instruction, is_critical)),
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
    const stepDetails = evaluation.step_details as any[] | null;

    // Calculate steps completed — use step_details first (formative mode), fall back to step_marks
    const steps = (skillSheet?.steps || []).sort((a: any, b: any) => a.step_number - b.step_number);
    const totalSteps = steps.length;
    const stepMarks = evaluation.step_marks as Record<string, string> | null;

    let passedSteps = 0;
    let criticalPassed = 0;
    const criticalSteps = steps.filter((s: any) => s.is_critical);

    if (stepDetails && stepDetails.length > 0) {
      // Formative mode: step_details has { completed, sequence_number, is_critical } per step
      passedSteps = stepDetails.filter((sd: any) => sd.completed).length;
      criticalPassed = stepDetails.filter((sd: any) => sd.completed && sd.is_critical).length;
    } else if (stepMarks) {
      passedSteps = Object.values(stepMarks).filter(m => m === 'pass').length;
      criticalPassed = criticalSteps.filter((s: any) => stepMarks[String(s.step_number)] === 'pass').length;
    }

    // Determine actual result — formative always saves 'pass' but email should reflect completion
    let displayResult = evaluation.result;
    if (evaluation.evaluation_type === 'formative') {
      // For formative: if not all steps done, show as "needs improvement"
      const allCriticalDone = criticalSteps.length === 0 || criticalPassed === criticalSteps.length;
      if (passedSteps < totalSteps || !allCriticalDone) {
        displayResult = 'remediation'; // "Needs Improvement"
      }
    }

    // Format date
    const evalDate = labDay?.date
      ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Build step-by-step HTML table for email body
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Build completion lookup from step_details (sequence numbers) or step_marks
    const completionMap: Record<number, { completed: boolean; sequence?: number }> = {};
    if (stepDetails && stepDetails.length > 0) {
      for (const sd of stepDetails) {
        completionMap[sd.step_number] = { completed: sd.completed, sequence: sd.sequence_number };
      }
    } else if (stepMarks) {
      for (const [sn, mark] of Object.entries(stepMarks)) {
        completionMap[parseInt(sn)] = { completed: mark === 'pass' };
      }
    }

    let stepTableRows = '';
    for (const step of steps) {
      const comp = completionMap[step.step_number];
      const isDone = comp?.completed || false;
      const seq = comp?.sequence;
      const statusSymbol = isDone ? '&#10003;' : '&mdash;';
      const statusColor = isDone ? '#10b981' : '#9ca3af';
      const seqLabel = seq ? `<span style="color: #6b7280; font-size: 10px;">${seq}</span>` : '';

      stepTableRows += `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 5px 10px; font-size: 12px; color: #6b7280; text-align: center; width: 30px;">${step.step_number}</td>
          <td style="padding: 5px 10px; font-size: 12px; color: #111827;">
            ${escapeHtml(step.instruction || '')}
            ${step.is_critical ? '<span style="color: #ef4444; font-weight: 700; font-size: 10px; margin-left: 4px;">[CRIT]</span>' : ''}
          </td>
          <td style="padding: 5px 10px; font-size: 12px; text-align: center; width: 30px;">${seqLabel}</td>
          <td style="padding: 5px 10px; font-size: 16px; text-align: center; width: 30px; color: ${statusColor}; font-weight: 700;">${statusSymbol}</td>
        </tr>`;
    }

    const resultColor = displayResult === 'pass' ? '#10b981' : displayResult === 'fail' ? '#ef4444' : '#f59e0b';
    const resultLabel = displayResult === 'pass' ? 'PASS' : displayResult === 'fail' ? 'FAIL' : 'NEEDS IMPROVEMENT';

    const scoreSheetHtml = `
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin: 16px 0;">
        <thead>
          <tr style="background-color: #1e40af; color: white;">
            <th style="padding: 6px 10px; font-size: 11px; text-align: center; width: 30px;">#</th>
            <th style="padding: 6px 10px; font-size: 11px; text-align: left;">Description</th>
            <th style="padding: 6px 10px; font-size: 11px; text-align: center; width: 30px;">Order</th>
            <th style="padding: 6px 10px; font-size: 11px; text-align: center; width: 30px;">&#10003;</th>
          </tr>
        </thead>
        <tbody>
          ${stepTableRows}
        </tbody>
      </table>
      <table style="width: 100%; margin: 12px 0; font-size: 13px;">
        <tr>
          <td><strong>Steps:</strong> ${passedSteps}/${totalSteps}</td>
          <td><strong>Critical:</strong> ${criticalPassed}/${criticalSteps.length}</td>
          <td><strong>Result:</strong> <span style="color: ${resultColor}; font-weight: 700;">${resultLabel}</span></td>
        </tr>
      </table>`;

    // Send email via Resend with full score sheet embedded
    console.log('[send-email] Sending to:', student.email, '| Skill:', skillSheet?.skill_name, '| Steps:', passedSteps + '/' + totalSteps, '| Result:', displayResult);
    const emailResult = await sendSkillEvaluationEmail(student.email, {
      evaluationId: evaluation.id,
      studentFirstName: student.first_name,
      skillName: skillSheet?.skill_name || 'Skill Evaluation',
      evaluationType: evaluation.evaluation_type,
      result: displayResult,
      stepsCompleted: totalSteps > 0 ? `${passedSteps}/${totalSteps}` : undefined,
      criticalSteps: criticalSteps.length > 0 ? `${criticalPassed}/${criticalSteps.length}` : undefined,
      notes: evaluation.notes || undefined,
      evaluatorName: evaluator?.name ? formatInstructorName(evaluator.name) : 'Instructor',
      date: evalDate,
      scoreSheetHtml,
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
