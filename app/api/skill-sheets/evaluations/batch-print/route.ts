import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderEvaluationPage(evaluation: any, includePageBreak: boolean = false, evalIndex?: number, totalEvals?: number): string {
  const student = evaluation.student;
  const skillSheet = evaluation.skill_sheet;
  const evaluator = evaluation.evaluator;
  const labDay = evaluation.lab_day;
  // step_marks can be { "1": "pass" } or step_details can be { "1": { status: "pass" } }
  const rawStepMarks = evaluation.step_marks || {};
  const stepDetails = evaluation.step_details || {};
  // Merge: prefer step_marks, fall back to step_details
  const stepMarks: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawStepMarks)) {
    stepMarks[k] = typeof v === 'string' ? v : (v as any)?.status || '';
  }
  for (const [k, v] of Object.entries(stepDetails)) {
    if (!stepMarks[k]) {
      stepMarks[k] = typeof v === 'string' ? v : (v as any)?.status || '';
    }
  }
  const flaggedItems = (evaluation.flagged_items || []) as { step_number: number; status: string }[];

  const steps = (skillSheet?.steps || []).sort((a: any, b: any) => a.step_number - b.step_number);
  const totalSteps = steps.length;
  const passedSteps = Object.values(stepMarks).filter(m => m === 'pass').length;
  const criticalSteps = steps.filter((s: any) => s.is_critical);
  const criticalPassed = criticalSteps.filter((s: any) => stepMarks[String(s.step_number)] === 'pass').length;

  const evalDate = labDay?.date
    ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const resultColor = evaluation.result === 'pass' ? '#10b981' : evaluation.result === 'fail' ? '#ef4444' : '#f59e0b';

  const phaseOrder = ['preparation', 'procedure', 'assessment', 'packaging'];
  const phaseLabels: Record<string, string> = { preparation: 'Preparation', procedure: 'Procedure', assessment: 'Assessment', packaging: 'Packaging' };
  const stepsByPhase: Record<string, any[]> = {};
  for (const step of steps) {
    const phase = step.phase || 'procedure';
    if (!stepsByPhase[phase]) stepsByPhase[phase] = [];
    stepsByPhase[phase].push(step);
  }
  const orderedPhases = [
    ...phaseOrder.filter(p => stepsByPhase[p]),
    ...Object.keys(stepsByPhase).filter(p => !phaseOrder.includes(p)),
  ];

  let stepRows = '';
  let stepNum = 0;
  for (const phase of orderedPhases) {
    const phaseSteps = stepsByPhase[phase];
    const phaseLabel = phaseLabels[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);
    stepRows += `<tr style="background-color: #f3f4f6;"><td colspan="3" style="padding: 6px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(phaseLabel)} (${phaseSteps.length})</td></tr>`;
    for (const step of phaseSteps) {
      stepNum++;
      const mark = stepMarks[String(step.step_number)];
      const flagged = flaggedItems.find((f: any) => f.step_number === step.step_number);
      const statusSymbol = mark === 'pass' ? '&#10003;' : mark === 'fail' ? '&#10007;' : flagged?.status === 'fail' ? '&#10007;' : flagged?.status === 'caution' ? '&#9888;' : '&mdash;';
      const statusColor = mark === 'pass' ? '#10b981' : mark === 'fail' ? '#ef4444' : flagged?.status === 'caution' ? '#f59e0b' : '#9ca3af';
      stepRows += `<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 5px 10px; font-size: 11px; color: #6b7280; text-align: center; width: 30px;">${stepNum}</td><td style="padding: 5px 10px; font-size: 11px; color: #111827;">${escapeHtml(step.instruction)}${step.is_critical ? ' <span style="color: #ef4444; font-weight: 700; font-size: 9px;">[CRIT]</span>' : ''}</td><td style="padding: 5px 10px; font-size: 14px; text-align: center; width: 40px; color: ${statusColor}; font-weight: 700;">${statusSymbol}</td></tr>`;
    }
  }

  return `
    <div ${includePageBreak ? 'style="page-break-before: always;"' : ''}>
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: baseline;">
        <h2 style="margin: 0; font-size: 15px; color: #111827;">${escapeHtml(skillSheet?.skill_name || 'Skill Evaluation')}</h2>
        ${evalIndex != null && totalEvals != null ? `<span style="font-size: 11px; color: #6b7280;">Evaluation ${evalIndex} of ${totalEvals}</span>` : ''}
      </div>
      <table style="width: 100%; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td><strong>Student:</strong> ${escapeHtml(student?.first_name || '')} ${escapeHtml(student?.last_name || '')}</td>
          <td><strong>Evaluator:</strong> ${evaluator?.name ? escapeHtml(formatInstructorName(evaluator.name)) : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Mode:</strong> ${evaluation.evaluation_type === 'formative' ? 'Formative' : 'Final Competency'}</td>
          <td><strong>Source:</strong> ${escapeHtml((skillSheet?.source || '').toUpperCase())}</td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-bottom: 12px;">
        <thead><tr style="background-color: #1e40af; color: white;"><th style="padding: 6px 10px; font-size: 10px; text-align: center; width: 30px;">#</th><th style="padding: 6px 10px; font-size: 10px; text-align: left;">Description</th><th style="padding: 6px 10px; font-size: 10px; text-align: center; width: 40px;">Status</th></tr></thead>
        <tbody>${stepRows}</tbody>
      </table>
      <table style="width: 100%; margin-bottom: 12px; font-size: 12px;">
        <tr><td><strong>Steps:</strong> ${passedSteps}/${totalSteps}</td><td><strong>Critical:</strong> ${criticalPassed}/${criticalSteps.length}</td><td><strong>Result:</strong> <span style="color: ${resultColor}; font-weight: 700;">${evaluation.result.toUpperCase()}</span></td></tr>
      </table>
      ${evaluation.notes ? `<div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; margin-bottom: 12px; font-size: 11px;"><strong>Comments:</strong> ${escapeHtml(evaluation.notes)}</div>` : ''}
      <div style="margin-top: 20px; display: flex; justify-content: space-between;">
        <div><div style="border-top: 1px solid #111; width: 200px; margin-top: 30px; padding-top: 4px; font-size: 10px; color: #6b7280;">Evaluator Signature</div></div>
        <div><div style="border-top: 1px solid #111; width: 120px; margin-top: 30px; padding-top: 4px; font-size: 10px; color: #6b7280;">Date</div></div>
      </div>
    </div>`;
}

export async function GET(request: NextRequest) {
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

    const labDayId = request.nextUrl.searchParams.get('lab_day_id');
    if (!labDayId) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }

    // Fetch lab day info
    const { data: labDay } = await supabase
      .from('lab_days')
      .select('id, date, title, cohort:cohorts!lab_days_cohort_id_fkey(id, cohort_number, program:programs!cohorts_program_id_fkey(name, abbreviation))')
      .eq('id', labDayId)
      .single();

    // Fetch all evaluations for this lab day
    const { data: evaluations, error: evalsError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, flagged_items, step_marks, step_details, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, phase, instruction, is_critical)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('lab_day_id', labDayId)
      .in('result', ['pass', 'fail'])
      .order('created_at', { ascending: true });

    if (evalsError || !evaluations?.length) {
      return NextResponse.json({ success: false, error: 'No completed evaluations found for this lab day' }, { status: 404 });
    }

    const cohort = (labDay as any)?.cohort;
    const labDate = labDay?.date
      ? new Date(labDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'Unknown Date';

    // Unique evaluators and stations
    const evaluatorNames = [...new Set(evaluations.map((e: any) => e.evaluator?.name).filter(Boolean))].map(n => formatInstructorName(n as string));
    const stationNames = [...new Set(evaluations.map((e: any) => e.skill_sheet?.skill_name).filter(Boolean))];
    const passCount = evaluations.filter((e: any) => e.result === 'pass').length;
    const failCount = evaluations.filter((e: any) => e.result === 'fail').length;

    const coverPage = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; text-align: center;">
        <h1 style="font-size: 28px; color: #1e40af; margin-bottom: 8px;">PMI Paramedic Program</h1>
        <h2 style="font-size: 20px; color: #374151; margin-bottom: 32px;">Skill Evaluation Report</h2>
        <div style="font-size: 16px; color: #4b5563; line-height: 2;">
          <p><strong>Date:</strong> ${labDate}</p>
          ${labDay?.title ? `<p><strong>Lab Day:</strong> ${escapeHtml(labDay.title)}</p>` : ''}
          ${cohort ? `<p><strong>Cohort:</strong> ${escapeHtml(cohort.program?.abbreviation || '')}${escapeHtml(String(cohort.cohort_number || ''))}</p>` : ''}
          <p><strong>Stations:</strong> ${stationNames.map(n => escapeHtml(n as string)).join(', ')}</p>
          <p><strong>Evaluator${evaluatorNames.length > 1 ? 's' : ''}:</strong> ${evaluatorNames.join(', ')}</p>
          <p><strong>Evaluations:</strong> ${evaluations.length} &nbsp;(<span style="color: #10b981;">${passCount} pass</span>${failCount > 0 ? ` / <span style="color: #ef4444;">${failCount} fail</span>` : ''})</p>
        </div>
      </div>`;

    const evalPages = evaluations.map((e: any, i: number) => renderEvaluationPage(e, true, i + 1, evaluations.length)).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lab Day Evaluations — ${labDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111827; max-width: 800px; margin: 0 auto; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
      Print All / Save as PDF
    </button>
    <span style="margin-left: 12px; color: #6b7280; font-size: 13px;">${evaluations.length} evaluations</span>
  </div>
  ${coverPage}
  ${evalPages}
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generating batch print:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate batch print' }, { status: 500 });
  }
}
