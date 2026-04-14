import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

interface EvalWithDetails {
  id: string;
  evaluation_type: string;
  result: string;
  notes: string | null;
  flagged_items: any;
  step_marks: Record<string, unknown> | null;
  created_at: string;
  is_retake: boolean;
  original_evaluation_id: string | null;
  skill_sheet: {
    id: string;
    skill_name: string;
    source: string;
    nremt_code: string | null;
    steps: any[];
  };
  evaluator: { id: string; name: string } | null;
}

function renderEvaluationSection(evaluation: EvalWithDetails, attemptLabel: string, includePageBreak: boolean): string {
  const skillSheet = evaluation.skill_sheet;
  const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
  const flaggedItems = (evaluation.flagged_items || []) as { step_number: number; status: string }[];

  const steps = (skillSheet?.steps || []).sort((a: any, b: any) => a.step_number - b.step_number);
  const totalSteps = steps.length;
  const isMultiPoint = steps.some((s: any) => (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0));
  const effPts = (s: any) => (s.sub_items && s.sub_items.length > 0) ? s.sub_items.length : (s.possible_points || 1);
  const totalPossiblePoints = steps.reduce((sum: number, s: any) => sum + effPts(s), 0);

  let passedSteps = 0;
  let earnedPoints = 0;
  const criticalSteps = steps.filter((s: any) => s.is_critical);
  let criticalPassed = 0;
  const criticalFailures: string[] = [];

  const stepMarkLookup: Record<string, { mark: string; points: number; subItems?: boolean[] }> = {};
  for (const [key, val] of Object.entries(rawMarks)) {
    if (typeof val === 'string') {
      const step = steps.find((s: any) => String(s.step_number) === key);
      const pts = val === 'pass' ? (step ? effPts(step) : 1) : 0;
      stepMarkLookup[key] = { mark: val, points: pts };
      if (val === 'pass') { passedSteps++; earnedPoints += pts; }
      if (step?.is_critical && val === 'pass') criticalPassed++;
      if (step?.is_critical && val === 'fail') criticalFailures.push(step.instruction);
    } else if (typeof val === 'object' && val !== null) {
      const obj = val as { completed?: boolean; sub_items?: boolean[]; points?: number };
      const pts = obj.points || 0;
      stepMarkLookup[key] = { mark: obj.completed ? 'pass' : 'fail', points: pts, subItems: obj.sub_items };
      earnedPoints += pts;
      if (obj.completed) passedSteps++;
      const step = steps.find((s: any) => String(s.step_number) === key);
      if (step?.is_critical && obj.completed) criticalPassed++;
      if (step?.is_critical && !obj.completed) criticalFailures.push(step.instruction);
    }
  }
  const stepMarks: Record<string, string> = {};
  for (const [k, v] of Object.entries(stepMarkLookup)) {
    stepMarks[k] = v.mark;
  }

  const resultColor = evaluation.result === 'pass' ? '#10b981' : evaluation.result === 'fail' ? '#ef4444' : '#f59e0b';

  // Group steps by phase
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
    const colSpan = isMultiPoint ? 4 : 3;
    stepRows += `<tr style="background-color: #f3f4f6;"><td colspan="${colSpan}" style="padding: 6px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(phaseLabel)} (${phaseSteps.length})</td></tr>`;
    for (const step of phaseSteps) {
      stepNum++;
      if (step.section_header) {
        stepRows += `<tr style="background-color: #e5e7eb;"><td colspan="${colSpan}" style="padding: 5px 10px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #1f2937;">${escapeHtml(step.section_header)}</td></tr>`;
      }
      const mark = stepMarks[String(step.step_number)];
      const markData = stepMarkLookup[String(step.step_number)];
      const flagged = flaggedItems.find((f) => f.step_number === step.step_number);
      const statusSymbol = mark === 'pass' ? '&#10003;' : mark === 'fail' ? '&#10007;' : flagged?.status === 'fail' ? '&#10007;' : flagged?.status === 'caution' ? '&#9888;' : '&mdash;';
      const statusColor = mark === 'pass' ? '#10b981' : mark === 'fail' ? '#ef4444' : flagged?.status === 'caution' ? '#f59e0b' : '#9ca3af';
      const earnedPts = markData?.points || 0;
      const possiblePts = effPts(step);
      stepRows += `<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 5px 10px; font-size: 11px; color: #6b7280; text-align: center; width: 30px;">${stepNum}</td><td style="padding: 5px 10px; font-size: 11px; color: #111827;">${escapeHtml(step.instruction)}${step.is_critical ? ' <span style="color: #ef4444; font-weight: 700; font-size: 9px;">[CRIT]</span>' : ''}</td>${isMultiPoint ? `<td style="padding: 5px 10px; font-size: 10px; text-align: center; width: 40px; color: #6b7280;">${earnedPts}/${possiblePts}</td>` : ''}<td style="padding: 5px 10px; font-size: 14px; text-align: center; width: 40px; color: ${statusColor}; font-weight: 700;">${statusSymbol}</td></tr>`;
      if (step.sub_items && Array.isArray(step.sub_items) && markData?.subItems) {
        for (let i = 0; i < step.sub_items.length; i++) {
          const subItem = step.sub_items[i];
          const subLabel = subItem.label || subItem.description || String(subItem);
          const subChecked = markData.subItems[i] || false;
          const subSymbol = subChecked ? '&#10003;' : '&mdash;';
          const subColor = subChecked ? '#10b981' : '#9ca3af';
          stepRows += `<tr style="border-bottom: 1px solid #f9fafb; background-color: #fafafa;"><td></td><td style="padding: 3px 10px 3px 28px; font-size: 10px; color: #4b5563;">${escapeHtml(subLabel)}</td>${isMultiPoint ? '<td></td>' : ''}<td style="padding: 3px 10px; font-size: 12px; text-align: center; color: ${subColor};">${subSymbol}</td></tr>`;
        }
      }
    }
  }

  return `
    <div class="page-break-before" ${includePageBreak ? 'style="page-break-before: always;"' : ''}>
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 15px; color: #111827;">${escapeHtml(skillSheet?.skill_name || 'Skill Evaluation')}</h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${attemptLabel ? `<span style="display: inline-flex; align-items: center; padding: 3px 10px; background-color: ${evaluation.is_retake ? '#fef3c7' : '#e0f2fe'}; color: ${evaluation.is_retake ? '#92400e' : '#0369a1'}; border: 1px solid ${evaluation.is_retake ? '#fde68a' : '#bae6fd'}; border-radius: 9999px; font-size: 10px; font-weight: 600;">${escapeHtml(attemptLabel)}</span>` : ''}
            ${skillSheet?.nremt_code ? `<span style="display: inline-flex; align-items: center; padding: 3px 10px; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 9999px; font-size: 10px; font-weight: 600;">NREMT ${escapeHtml(skillSheet.nremt_code)}</span>` : ''}
          </div>
        </div>
      </div>
      <table style="width: 100%; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td><strong>Evaluator:</strong> ${evaluation.evaluator?.name ? escapeHtml(formatInstructorName(evaluation.evaluator.name)) : 'N/A'}</td>
          <td><strong>Mode:</strong> ${evaluation.evaluation_type === 'formative' ? 'Formative' : 'Final Competency'}</td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-bottom: 12px;">
        <thead><tr style="background-color: #1e40af; color: white;"><th style="padding: 6px 10px; font-size: 10px; text-align: center; width: 30px;">#</th><th style="padding: 6px 10px; font-size: 10px; text-align: left;">Description</th>${isMultiPoint ? '<th style="padding: 6px 10px; font-size: 10px; text-align: center; width: 40px;">Points</th>' : ''}<th style="padding: 6px 10px; font-size: 10px; text-align: center; width: 40px;">Status</th></tr></thead>
        <tbody>${stepRows}</tbody>
      </table>
      <table style="width: 100%; margin-bottom: 12px; font-size: 12px;">
        <tr><td>${isMultiPoint ? `<strong>Points:</strong> ${earnedPoints}/${totalPossiblePoints} (${totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0}%)` : `<strong>Steps:</strong> ${passedSteps}/${totalSteps}`}</td><td><strong>Critical:</strong> ${criticalPassed}/${criticalSteps.length}</td><td><strong>Result:</strong> <span style="color: ${resultColor}; font-weight: 700;">${evaluation.result.toUpperCase()}</span></td></tr>
      </table>
      ${criticalFailures.length > 0 ? `
        <div style="border: 1px solid #fecaca; border-radius: 4px; padding: 8px; margin-bottom: 12px; font-size: 11px; background-color: #fef2f2;">
          <strong style="color: #dc2626;">Critical Failures:</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            ${criticalFailures.map(f => `<li style="color: #991b1b;">${escapeHtml(f)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${evaluation.notes ? `<div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; margin-bottom: 12px; font-size: 11px;"><strong>Comments:</strong> ${escapeHtml(evaluation.notes)}</div>` : ''}
      <div style="margin-top: 20px; display: flex; justify-content: space-between;">
        <div><div style="border-top: 1px solid #111; width: 200px; margin-top: 30px; padding-top: 4px; font-size: 10px; color: #6b7280;">Evaluator Signature</div></div>
        <div><div style="border-top: 1px solid #111; width: 120px; margin-top: 30px; padding-top: 4px; font-size: 10px; color: #6b7280;">Date</div></div>
      </div>
    </div>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: labDayId } = await params;
    const studentId = request.nextUrl.searchParams.get('student_id');
    if (!studentId) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get lab day info
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select('id, date, title, is_nremt_testing, cohort:cohorts!lab_days_cohort_id_fkey(id, cohort_number, program:programs!cohorts_program_id_fkey(name, abbreviation))')
      .eq('id', labDayId)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    // 2. Get student info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    // 3. Get all evaluations for this student on this lab day
    const { data: evaluations, error: evalsError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, flagged_items, step_marks, created_at, is_retake, original_evaluation_id,
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, nremt_code, steps:skill_sheet_steps(step_number, phase, instruction, is_critical, possible_points, sub_items, section_header)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name)
      `)
      .eq('lab_day_id', labDayId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (evalsError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    // 4. Group evaluations by skill, identifying first attempts and retakes
    const skillGroups = new Map<string, EvalWithDetails[]>();
    for (const ev of (evaluations || [])) {
      const skillName = (ev.skill_sheet as any)?.skill_name || 'Unknown';
      if (!skillGroups.has(skillName)) skillGroups.set(skillName, []);
      skillGroups.get(skillName)!.push(ev as unknown as EvalWithDetails);
    }

    // 5. Calculate overall results
    const totalSkills = skillGroups.size;
    let passedSkills = 0;
    const skillSummaryRows: string[] = [];

    for (const [skillName, evals] of skillGroups) {
      const bestResult = evals.some(e => e.result === 'pass') ? 'pass' : evals[evals.length - 1]?.result || 'incomplete';
      if (bestResult === 'pass') passedSkills++;
      const nremtCode = (evals[0].skill_sheet as any)?.nremt_code;
      const hasRetake = evals.some(e => e.is_retake);
      const resultColor = bestResult === 'pass' ? '#10b981' : bestResult === 'fail' ? '#ef4444' : '#f59e0b';
      const resultLabel = bestResult === 'pass' ? 'PASS' : bestResult === 'fail' ? 'FAIL' : 'INCOMPLETE';
      skillSummaryRows.push(`
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 12px; font-size: 13px; color: #111827;">${escapeHtml(skillName)}${nremtCode ? ` <span style="color: #6b7280; font-size: 11px;">(${escapeHtml(nremtCode)})</span>` : ''}</td>
          <td style="padding: 8px 12px; text-align: center;"><span style="color: ${resultColor}; font-weight: 700; font-size: 13px;">${resultLabel}</span>${hasRetake ? ' <span style="background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">RETAKE</span>' : ''}</td>
          <td style="padding: 8px 12px; text-align: center; font-size: 12px; color: #6b7280;">${evals.length}</td>
        </tr>
      `);
    }

    const allPassed = totalSkills > 0 && passedSkills === totalSkills;
    const labDate = labDay.date
      ? new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'Unknown Date';
    const dateForFilename = labDay.date || new Date().toISOString().split('T')[0];
    const cohort = labDay.cohort as any;

    // 6. Build cover section
    const coverSection = `
      <div style="text-align: center; padding: 40px 20px 30px 20px;">
        <h1 style="font-size: 24px; color: #1e40af; margin: 0 0 4px 0;">PMI Paramedic Program</h1>
        <h2 style="font-size: 16px; color: #6b7280; margin: 0 0 24px 0;">NREMT Skill Evaluation Report</h2>

        <div style="font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 4px;">
          ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}
        </div>
        ${cohort ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">${escapeHtml(cohort.program?.abbreviation || '')} Cohort ${cohort.cohort_number || ''}</div>` : ''}
        <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">${labDate}</div>
        ${labDay.title ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">${escapeHtml(labDay.title)}</div>` : '<div style="margin-bottom: 24px;"></div>'}

        <div style="display: inline-block; padding: 12px 32px; border-radius: 8px; font-size: 18px; font-weight: 700; ${
          allPassed
            ? 'background-color: #dcfce7; color: #166534; border: 2px solid #86efac;'
            : `background-color: ${passedSkills === 0 ? '#fef2f2' : '#fffbeb'}; color: ${passedSkills === 0 ? '#991b1b' : '#92400e'}; border: 2px solid ${passedSkills === 0 ? '#fecaca' : '#fde68a'};`
        }">
          ${allPassed ? 'ALL SKILLS PASSED' : `INCOMPLETE &mdash; ${passedSkills} of ${totalSkills} passed`}
        </div>
      </div>

      <div style="max-width: 500px; margin: 24px auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background-color: #1e40af; color: white;">
              <th style="padding: 8px 12px; font-size: 11px; text-align: left;">Skill</th>
              <th style="padding: 8px 12px; font-size: 11px; text-align: center;">Result</th>
              <th style="padding: 8px 12px; font-size: 11px; text-align: center;">Attempts</th>
            </tr>
          </thead>
          <tbody>
            ${skillSummaryRows.join('')}
          </tbody>
        </table>
      </div>
    `;

    // 7. Build evaluation pages
    let evalPages = '';
    for (const [, evals] of skillGroups) {
      const hasRetake = evals.some(e => e.is_retake);
      for (let i = 0; i < evals.length; i++) {
        const ev = evals[i];
        const attemptLabel = hasRetake
          ? (ev.is_retake ? 'Retake Attempt' : 'Attempt 1')
          : '';
        evalPages += renderEvaluationSection(ev, attemptLabel, true);
      }
    }

    // 8. Handle no evaluations
    if (!evaluations || evaluations.length === 0) {
      const noEvalsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NREMT Results — ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111827; max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body>
  <div style="text-align: center; padding: 60px 20px;">
    <h1 style="font-size: 20px; color: #6b7280;">No Evaluations Found</h1>
    <p style="color: #9ca3af; margin-top: 8px;">${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)} has no evaluations for this lab day.</p>
  </div>
</body>
</html>`;
      return new NextResponse(noEvalsHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="NREMT_${dateForFilename}_${student.last_name}_${student.first_name}.pdf"`,
        },
      });
    }

    // 9. Assemble full HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NREMT Results — ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111827; max-width: 800px; margin: 0 auto; }
    .page-break-before { page-break-before: always; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .page-break-before { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
      Print / Save as PDF
    </button>
  </div>
  ${coverSection}
  ${evalPages}
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="NREMT_${dateForFilename}_${student.last_name}_${student.first_name}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating student PDF:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate student PDF' }, { status: 500 });
  }
}
