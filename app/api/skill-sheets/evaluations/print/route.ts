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

interface EvalData {
  id: string;
  evaluation_type: string;
  result: string;
  notes: string | null;
  flagged_items: any;
  step_marks: Record<string, string> | null;
  created_at: string;
  student: any;
  skill_sheet: any;
  evaluator: any;
  lab_day: any;
}

function renderEvaluationPage(evaluation: EvalData, includePageBreak: boolean = false): string {
  const student = evaluation.student;
  const skillSheet = evaluation.skill_sheet;
  const evaluator = evaluation.evaluator;
  const labDay = evaluation.lab_day;
  const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
  const flaggedItems = (evaluation.flagged_items || []) as { step_number: number; status: string }[];

  const steps = (skillSheet?.steps || []).sort((a: any, b: any) => a.step_number - b.step_number);
  const totalSteps = steps.length;
  const isMultiPoint = steps.some((s: any) => (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0));
  const effPts = (s: any) => (s.sub_items && s.sub_items.length > 0) ? s.sub_items.length : (s.possible_points || 1);
  const totalPossiblePoints = steps.reduce((sum: number, s: any) => sum + effPts(s), 0);

  // Calculate stats handling both old (string) and new (object) step_marks formats
  let passedSteps = 0;
  let earnedPoints = 0;
  const criticalSteps = steps.filter((s: any) => s.is_critical);
  let criticalPassed = 0;

  // Build a normalized mark lookup: stepNumber -> { mark, points, subItems }
  const stepMarkLookup: Record<string, { mark: string; points: number; subItems?: boolean[] }> = {};
  for (const [key, val] of Object.entries(rawMarks)) {
    if (typeof val === 'string') {
      // Old format: simple string
      const step = steps.find((s: any) => String(s.step_number) === key);
      const pts = val === 'pass' ? (step ? effPts(step) : 1) : 0;
      stepMarkLookup[key] = { mark: val, points: pts };
      if (val === 'pass') { passedSteps++; earnedPoints += pts; }
      if (step?.is_critical && val === 'pass') criticalPassed++;
    } else if (typeof val === 'object' && val !== null) {
      // New format: { completed, sub_items, points }
      const obj = val as { completed?: boolean; sub_items?: boolean[]; points?: number };
      const pts = obj.points || 0;
      stepMarkLookup[key] = { mark: obj.completed ? 'pass' : 'fail', points: pts, subItems: obj.sub_items };
      earnedPoints += pts;
      if (obj.completed) passedSteps++;
      const step = steps.find((s: any) => String(s.step_number) === key);
      if (step?.is_critical && obj.completed) criticalPassed++;
    }
  }
  // Backward compat alias
  const stepMarks: Record<string, string> = {};
  for (const [k, v] of Object.entries(stepMarkLookup)) {
    stepMarks[k] = v.mark;
  }

  const evalDate = labDay?.date
    ? new Date(labDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(evaluation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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

    stepRows += `
      <tr style="background-color: #f3f4f6;">
        <td colspan="4" style="padding: 6px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; border-bottom: 1px solid #e5e7eb;">
          ${escapeHtml(phaseLabel)} (${phaseSteps.length} steps)
        </td>
      </tr>`;

    for (const step of phaseSteps) {
      stepNum++;

      // Section header
      if (step.section_header) {
        stepRows += `
          <tr style="background-color: #e5e7eb;">
            <td colspan="4" style="padding: 6px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #1f2937; border-bottom: 1px solid #d1d5db;">
              ${escapeHtml(step.section_header)}
            </td>
          </tr>`;
      }

      const mark = stepMarks[String(step.step_number)];
      const markData = stepMarkLookup[String(step.step_number)];
      const flagged = flaggedItems.find(f => f.step_number === step.step_number);
      const statusSymbol = mark === 'pass' ? '&#10003;' : mark === 'fail' ? '&#10007;' : flagged?.status === 'fail' ? '&#10007;' : flagged?.status === 'caution' ? '&#9888;' : '&mdash;';
      const statusColor = mark === 'pass' ? '#10b981' : mark === 'fail' ? '#ef4444' : flagged?.status === 'caution' ? '#f59e0b' : '#9ca3af';

      // Points column for multi-point steps
      const possiblePts = effPts(step);
      const earnedPts = markData?.points || 0;
      const pointsDisplay = isMultiPoint ? `${earnedPts}/${possiblePts}` : '';

      stepRows += `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 6px 12px; font-size: 12px; color: #6b7280; text-align: center; width: 40px;">${stepNum}</td>
          <td style="padding: 6px 12px; font-size: 12px; color: #111827;">
            ${escapeHtml(step.instruction)}
            ${step.is_critical ? '<span style="color: #ef4444; font-weight: 700; font-size: 10px; margin-left: 4px;">[CRIT]</span>' : ''}
          </td>
          ${isMultiPoint ? `<td style="padding: 6px 12px; font-size: 11px; text-align: center; width: 50px; color: #6b7280;">${pointsDisplay}</td>` : ''}
          <td style="padding: 6px 12px; font-size: 16px; text-align: center; width: 50px; color: ${statusColor}; font-weight: 700;">${statusSymbol}</td>
        </tr>`;

      // Sub-item rows
      if (step.sub_items && Array.isArray(step.sub_items) && markData?.subItems) {
        for (let i = 0; i < step.sub_items.length; i++) {
          const subItem = step.sub_items[i];
          const subLabel = subItem.label || subItem.description || String(subItem);
          const subChecked = markData.subItems[i] || false;
          const subSymbol = subChecked ? '&#10003;' : '&mdash;';
          const subColor = subChecked ? '#10b981' : '#9ca3af';
          stepRows += `
            <tr style="border-bottom: 1px solid #f9fafb; background-color: #fafafa;">
              <td style="padding: 3px 12px;"></td>
              <td style="padding: 3px 12px 3px 32px; font-size: 11px; color: #4b5563;">
                ${escapeHtml(subLabel)}
              </td>
              ${isMultiPoint ? '<td style="padding: 3px 12px;"></td>' : ''}
              <td style="padding: 3px 12px; font-size: 14px; text-align: center; width: 50px; color: ${subColor};">${subSymbol}</td>
            </tr>`;
        }
      }
    }
  }

  return `
    <div class="eval-page" ${includePageBreak ? 'style="page-break-before: always;"' : ''}>
      <!-- Header -->
      <div style="border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="margin: 0 0 4px 0; font-size: 18px; color: #111827;">PMI Paramedic Program — Skill Evaluation</h1>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
          <span>Pima Medical Institute</span>
          <span>${evalDate}</span>
        </div>
      </div>

      <!-- Student Info -->
      <table style="width: 100%; margin-bottom: 16px; font-size: 13px;">
        <tr>
          <td style="width: 50%;"><strong>Student:</strong> ${escapeHtml(student?.first_name || '')} ${escapeHtml(student?.last_name || '')}</td>
          <td style="width: 50%;"><strong>Evaluator:</strong> ${evaluator?.name ? escapeHtml(formatInstructorName(evaluator.name)) : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Skill:</strong> ${escapeHtml(skillSheet?.skill_name || 'N/A')}</td>
          <td><strong>Lab Day:</strong> ${labDay?.title ? escapeHtml(labDay.title) : evalDate}</td>
        </tr>
        <tr>
          <td><strong>Mode:</strong> ${evaluation.evaluation_type === 'formative' ? 'Formative' : 'Final Competency'}</td>
          <td><strong>Source:</strong> ${escapeHtml((skillSheet?.source || 'N/A').toUpperCase())}</td>
        </tr>
      </table>

      <!-- Steps Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-bottom: 16px;">
        <thead>
          <tr style="background-color: #1e40af; color: white;">
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 40px;">#</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: left;">Description</th>
            ${isMultiPoint ? '<th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 50px;">Points</th>' : ''}
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 50px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${stepRows}
        </tbody>
      </table>

      <!-- Summary -->
      <table style="width: 100%; margin-bottom: 16px; font-size: 13px;">
        <tr>
          ${isMultiPoint
            ? `<td style="width: 33%;"><strong>Points:</strong> ${earnedPoints}/${totalPossiblePoints} (${totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0}%)</td>`
            : `<td style="width: 33%;"><strong>Steps Completed:</strong> ${passedSteps}/${totalSteps}</td>`
          }
          <td style="width: 33%;"><strong>Critical Steps:</strong> ${criticalPassed}/${criticalSteps.length}</td>
          <td style="width: 33%;"><strong>Result:</strong> <span style="color: ${resultColor}; font-weight: 700; font-size: 15px;">${evaluation.result.toUpperCase()}</span></td>
        </tr>
      </table>

      <!-- Notes -->
      ${evaluation.notes ? `
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 16px; background-color: #fafafa;">
          <strong style="font-size: 12px; color: #374151;">Comments:</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #4b5563;">${escapeHtml(evaluation.notes)}</p>
        </div>
      ` : ''}

      <!-- Signature Line -->
      <div style="margin-top: 32px; display: flex; justify-content: space-between;">
        <div>
          <div style="border-top: 1px solid #111827; width: 240px; margin-top: 40px; padding-top: 4px; font-size: 11px; color: #6b7280;">
            Evaluator Signature
          </div>
        </div>
        <div>
          <div style="border-top: 1px solid #111827; width: 140px; margin-top: 40px; padding-top: 4px; font-size: 11px; color: #6b7280;">
            Date
          </div>
        </div>
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

    const evaluationId = request.nextUrl.searchParams.get('evaluation_id');
    if (!evaluationId) {
      return NextResponse.json({ success: false, error: 'evaluation_id is required' }, { status: 400 });
    }

    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, flagged_items, step_marks, created_at,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, steps:skill_sheet_steps(step_number, phase, instruction, is_critical, possible_points, sub_items, section_header)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('id', evaluationId)
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
    }

    const student = evaluation.student as any;
    const skillSheet = evaluation.skill_sheet as any;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Skill Evaluation — ${escapeHtml(student?.first_name || '')} ${escapeHtml(student?.last_name || '')} — ${escapeHtml(skillSheet?.skill_name || '')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111827; max-width: 800px; margin: 0 auto; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .eval-page { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
      Print / Save as PDF
    </button>
  </div>
  ${renderEvaluationPage(evaluation as unknown as EvalData)}
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generating print view:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate print view' }, { status: 500 });
  }
}
