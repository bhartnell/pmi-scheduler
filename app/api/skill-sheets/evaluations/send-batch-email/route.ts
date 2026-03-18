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

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, name, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { lab_day_id, evaluation_ids } = await request.json();

    if (!lab_day_id && !evaluation_ids) {
      return NextResponse.json({ success: false, error: 'lab_day_id or evaluation_ids required' }, { status: 400 });
    }

    // Build query for queued evaluations
    let query = supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, email_status, flagged_items, step_marks, step_details, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, phase, instruction, is_critical)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('email_status', 'queued');

    if (lab_day_id) {
      query = query.eq('lab_day_id', lab_day_id);
    } else if (evaluation_ids) {
      query = query.in('id', evaluation_ids);
    }

    const { data: evaluations, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, sent: 0, skipped: 0, errors: 0, message: 'No queued evaluations found' });
    }

    // Count excluded evaluations for reporting
    let doNotSendCount = 0;
    let finalCount = 0;
    if (lab_day_id) {
      const { count: dnsCount } = await supabase
        .from('student_skill_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('lab_day_id', lab_day_id)
        .eq('email_status', 'do_not_send');
      doNotSendCount = dnsCount || 0;

      const { count: fCount } = await supabase
        .from('student_skill_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('lab_day_id', lab_day_id)
        .eq('evaluation_type', 'final_competency');
      finalCount = fCount || 0;
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process in batches of 5 for rate limiting
    for (let i = 0; i < evaluations.length; i += 5) {
      const batch = evaluations.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (evaluation) => {
          const student = evaluation.student as any;
          if (!student?.email) {
            skipped++;
            return;
          }

          const skillSheet = evaluation.skill_sheet as any;
          const evaluator = evaluation.evaluator as any;
          const labDay = evaluation.lab_day as any;
          const stepDetails = (evaluation as any).step_details as any[] | null;

          const steps = (skillSheet?.steps || []).sort((a: any, b: any) => a.step_number - b.step_number);
          const totalSteps = steps.length;
          const stepMarks = evaluation.step_marks as Record<string, string> | null;
          const criticalSteps = steps.filter((s: any) => s.is_critical);

          let passedSteps = 0;
          let criticalPassed = 0;
          if (stepDetails && stepDetails.length > 0) {
            passedSteps = stepDetails.filter((sd: any) => sd.completed).length;
            criticalPassed = stepDetails.filter((sd: any) => sd.completed && sd.is_critical).length;
          } else if (stepMarks) {
            passedSteps = Object.values(stepMarks).filter(m => m === 'pass').length;
            criticalPassed = criticalSteps.filter((s: any) => stepMarks[String(s.step_number)] === 'pass').length;
          }

          // Determine display result
          let displayResult = evaluation.result;
          if (evaluation.evaluation_type === 'formative') {
            const allCriticalDone = criticalSteps.length === 0 || criticalPassed === criticalSteps.length;
            if (passedSteps < totalSteps || !allCriticalDone) displayResult = 'remediation';
          }

          const evalDate = labDay?.date
            ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          // Build score sheet HTML
          const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const completionMap: Record<number, { completed: boolean; sequence?: number }> = {};
          if (stepDetails && stepDetails.length > 0) {
            for (const sd of stepDetails) completionMap[sd.step_number] = { completed: sd.completed, sequence: sd.sequence_number };
          } else if (stepMarks) {
            for (const [sn, mark] of Object.entries(stepMarks)) completionMap[parseInt(sn)] = { completed: mark === 'pass' };
          }

          let stepTableRows = '';
          for (const step of steps) {
            const comp = completionMap[step.step_number];
            const isDone = comp?.completed || false;
            const seq = comp?.sequence;
            stepTableRows += `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:4px 8px;font-size:12px;color:#6b7280;text-align:center;width:30px;">${step.step_number}</td><td style="padding:4px 8px;font-size:12px;color:#111827;">${escapeHtml(step.instruction || '')}${step.is_critical ? ' <span style="color:#ef4444;font-weight:700;font-size:10px;">[CRIT]</span>' : ''}</td><td style="padding:4px 8px;font-size:12px;text-align:center;width:30px;">${seq ? `<span style="color:#6b7280;font-size:10px;">${seq}</span>` : ''}</td><td style="padding:4px 8px;font-size:16px;text-align:center;width:30px;color:${isDone ? '#10b981' : '#9ca3af'};font-weight:700;">${isDone ? '&#10003;' : '&mdash;'}</td></tr>`;
          }

          const resultColor = displayResult === 'pass' ? '#10b981' : displayResult === 'fail' ? '#ef4444' : '#f59e0b';
          const resultLabel = displayResult === 'pass' ? 'PASS' : displayResult === 'fail' ? 'FAIL' : 'NEEDS IMPROVEMENT';
          const scoreSheetHtml = `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;margin:16px 0;"><thead><tr style="background-color:#1e40af;color:white;"><th style="padding:6px 8px;font-size:11px;text-align:center;width:30px;">#</th><th style="padding:6px 8px;font-size:11px;text-align:left;">Description</th><th style="padding:6px 8px;font-size:11px;text-align:center;width:30px;">Order</th><th style="padding:6px 8px;font-size:11px;text-align:center;width:30px;">&#10003;</th></tr></thead><tbody>${stepTableRows}</tbody></table><table style="width:100%;margin:12px 0;font-size:13px;"><tr><td><strong>Steps:</strong> ${passedSteps}/${totalSteps}</td><td><strong>Critical:</strong> ${criticalPassed}/${criticalSteps.length}</td><td><strong>Result:</strong> <span style="color:${resultColor};font-weight:700;">${resultLabel}</span></td></tr></table>`;

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

          if (emailResult.success) {
            await supabase
              .from('student_skill_evaluations')
              .update({ email_status: 'sent' })
              .eq('id', evaluation.id);
            sent++;
          } else {
            errors++;
            errorDetails.push(`${student.first_name} ${student.last_name}: ${emailResult.error}`);
          }
        })
      );

      // Check for unhandled rejections
      results.forEach(r => {
        if (r.status === 'rejected') {
          errors++;
          errorDetails.push(r.reason?.message || 'Unknown error');
        }
      });
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      errors,
      doNotSendCount,
      finalCount,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    });
  } catch (error) {
    console.error('Error in batch email send:', error);
    return NextResponse.json({ success: false, error: 'Failed to send batch emails' }, { status: 500 });
  }
}
