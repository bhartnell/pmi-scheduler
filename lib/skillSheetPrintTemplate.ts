/**
 * Shared HTML renderer for skill evaluation print/PDF output.
 *
 * Single source of truth so the single-skill print endpoint and the
 * full-student packet endpoint emit identical, white-background, clean
 * per-evaluation sections. Previously each endpoint had its own copy of
 * the template which drifted over time — the packet endpoint's version
 * was visibly "rougher" than the single-skill print, which is the bug
 * this module exists to fix.
 *
 * Consumers:
 *   - app/api/skill-sheets/evaluations/print/route.ts
 *   - app/api/lab-management/lab-days/[id]/student-pdf/route.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EvalDataForPrint {
  id: string;
  evaluation_type: string;
  result: string;
  notes: string | null;
  flagged_items: any;
  step_marks: Record<string, unknown> | null;
  created_at: string;
  is_retake?: boolean;
  student: any;
  skill_sheet: any;
  evaluator: any;
  lab_day: any;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatInstructorName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

/**
 * Render a single evaluation as a self-contained HTML fragment (no
 * doctype/html/body). Caller is responsible for wrapping in a document
 * shell and providing the page styles.
 *
 * @param evaluation  Normalized evaluation with embedded student, skill_sheet,
 *                    evaluator, and lab_day objects.
 * @param opts.includePageBreak  If true, adds `page-break-before: always`
 *                    to the root div so multiple sections stack cleanly.
 * @param opts.attemptLabel      Optional badge text shown next to the skill
 *                    title (e.g. "Attempt 1", "Retake Attempt").
 */
export function renderEvaluationSection(
  evaluation: EvalDataForPrint,
  opts: { includePageBreak?: boolean; attemptLabel?: string } = {}
): string {
  const { includePageBreak = false, attemptLabel = '' } = opts;

  const student = evaluation.student;
  const skillSheet = evaluation.skill_sheet;
  const evaluator = evaluation.evaluator;
  const labDay = evaluation.lab_day;
  const rawMarks = (evaluation.step_marks || {}) as Record<string, unknown>;
  const flaggedItems = (evaluation.flagged_items || []) as {
    step_number: number;
    status: string;
  }[];

  const steps = (skillSheet?.steps || []).sort(
    (a: any, b: any) => a.step_number - b.step_number
  );
  const totalSteps = steps.length;
  const isMultiPoint = steps.some(
    (s: any) =>
      (s.possible_points && s.possible_points > 1) ||
      (s.sub_items && s.sub_items.length > 0)
  );
  const effPts = (s: any) =>
    s.sub_items && s.sub_items.length > 0
      ? s.sub_items.length
      : s.possible_points || 1;
  const totalPossiblePoints = steps.reduce(
    (sum: number, s: any) => sum + effPts(s),
    0
  );

  // Normalize step_marks to handle both legacy 'pass'/'fail' strings and
  // the current { completed, sub_items, points } object shape.
  let passedSteps = 0;
  let earnedPoints = 0;
  const criticalSteps = steps.filter((s: any) => s.is_critical);
  let criticalPassed = 0;
  const criticalFailures: string[] = [];

  const stepMarkLookup: Record<
    string,
    { mark: string; points: number; subItems?: boolean[] }
  > = {};
  for (const [key, val] of Object.entries(rawMarks)) {
    if (typeof val === 'string') {
      const step = steps.find((s: any) => String(s.step_number) === key);
      const pts = val === 'pass' ? (step ? effPts(step) : 1) : 0;
      stepMarkLookup[key] = { mark: val, points: pts };
      if (val === 'pass') {
        passedSteps++;
        earnedPoints += pts;
      }
      if (step?.is_critical && val === 'pass') criticalPassed++;
      if (step?.is_critical && val === 'fail')
        criticalFailures.push(step.instruction);
    } else if (typeof val === 'object' && val !== null) {
      const obj = val as {
        completed?: boolean;
        sub_items?: boolean[];
        points?: number;
      };
      const pts = obj.points || 0;
      stepMarkLookup[key] = {
        mark: obj.completed ? 'pass' : 'fail',
        points: pts,
        subItems: obj.sub_items,
      };
      earnedPoints += pts;
      if (obj.completed) passedSteps++;
      const step = steps.find((s: any) => String(s.step_number) === key);
      if (step?.is_critical && obj.completed) criticalPassed++;
      if (step?.is_critical && !obj.completed)
        criticalFailures.push(step.instruction);
    }
  }
  const stepMarks: Record<string, string> = {};
  for (const [k, v] of Object.entries(stepMarkLookup)) stepMarks[k] = v.mark;

  const evalDate = labDay?.date
    ? new Date(labDay.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date(evaluation.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

  const resultColor =
    evaluation.result === 'pass'
      ? '#10b981'
      : evaluation.result === 'fail'
      ? '#ef4444'
      : '#f59e0b';

  // Group steps by phase
  const phaseOrder = ['preparation', 'procedure', 'assessment', 'packaging'];
  const phaseLabels: Record<string, string> = {
    preparation: 'Preparation',
    procedure: 'Procedure',
    assessment: 'Assessment',
    packaging: 'Packaging',
  };
  const stepsByPhase: Record<string, any[]> = {};
  for (const step of steps) {
    const phase = step.phase || 'procedure';
    if (!stepsByPhase[phase]) stepsByPhase[phase] = [];
    stepsByPhase[phase].push(step);
  }
  const orderedPhases = [
    ...phaseOrder.filter((p) => stepsByPhase[p]),
    ...Object.keys(stepsByPhase).filter((p) => !phaseOrder.includes(p)),
  ];

  let stepRows = '';
  let stepNum = 0;
  for (const phase of orderedPhases) {
    const phaseSteps = stepsByPhase[phase];
    const phaseLabel =
      phaseLabels[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);

    stepRows += `
      <tr style="background-color: #f3f4f6;">
        <td colspan="4" style="padding: 6px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; border-bottom: 1px solid #e5e7eb;">
          ${escapeHtml(phaseLabel)} (${phaseSteps.length} steps)
        </td>
      </tr>`;

    for (const step of phaseSteps) {
      stepNum++;

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
      const flagged = flaggedItems.find((f) => f.step_number === step.step_number);
      const statusSymbol =
        mark === 'pass'
          ? '&#10003;'
          : mark === 'fail'
          ? '&#10007;'
          : flagged?.status === 'fail'
          ? '&#10007;'
          : flagged?.status === 'caution'
          ? '&#9888;'
          : '&mdash;';
      const statusColor =
        mark === 'pass'
          ? '#10b981'
          : mark === 'fail'
          ? '#ef4444'
          : flagged?.status === 'caution'
          ? '#f59e0b'
          : '#9ca3af';

      const possiblePts = effPts(step);
      const earnedPts = markData?.points || 0;
      const pointsDisplay = isMultiPoint ? `${earnedPts}/${possiblePts}` : '';

      stepRows += `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 6px 12px; font-size: 12px; color: #6b7280; text-align: center; width: 40px;">${stepNum}</td>
          <td style="padding: 6px 12px; font-size: 12px; color: #111827;">
            ${escapeHtml(step.instruction)}
            ${
              step.is_critical
                ? '<span style="color: #ef4444; font-weight: 700; font-size: 10px; margin-left: 4px;">[CRIT]</span>'
                : ''
            }
          </td>
          ${
            isMultiPoint
              ? `<td style="padding: 6px 12px; font-size: 11px; text-align: center; width: 50px; color: #6b7280;">${pointsDisplay}</td>`
              : ''
          }
          <td style="padding: 6px 12px; font-size: 16px; text-align: center; width: 50px; color: ${statusColor}; font-weight: 700;">${statusSymbol}</td>
        </tr>`;

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

  const attemptBadge = attemptLabel
    ? `<span style="display: inline-flex; align-items: center; padding: 3px 10px; background-color: ${
        evaluation.is_retake ? '#fef3c7' : '#e0f2fe'
      }; color: ${
        evaluation.is_retake ? '#92400e' : '#0369a1'
      }; border: 1px solid ${
        evaluation.is_retake ? '#fde68a' : '#bae6fd'
      }; border-radius: 9999px; font-size: 11px; font-weight: 600; margin-right: 6px;">${escapeHtml(
        attemptLabel
      )}</span>`
    : '';

  return `
    <div class="eval-page" style="background-color: #ffffff; color: #111827; ${
      includePageBreak ? 'page-break-before: always; ' : ''
    }">
      <!-- Header -->
      <div style="border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1 style="margin: 0 0 4px 0; font-size: 18px; color: #111827;">PMI Paramedic Program &mdash; Skill Evaluation</h1>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${attemptBadge}
            ${
              skillSheet?.source === 'nremt'
                ? `
              <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 9999px; font-size: 12px; font-weight: 600;">
                &#10003; NREMT Official${
                  skillSheet?.nremt_code
                    ? ` &mdash; Code: ${escapeHtml(skillSheet.nremt_code)}`
                    : ''
                }
              </span>
            `
                : ''
            }
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
          <span>Pima Medical Institute</span>
          <span>${evalDate}</span>
        </div>
      </div>

      <!-- Student Info -->
      <table style="width: 100%; margin-bottom: 16px; font-size: 13px; color: #111827;">
        <tr>
          <td style="width: 50%;"><strong>Student:</strong> ${escapeHtml(
            student?.first_name || ''
          )} ${escapeHtml(student?.last_name || '')}</td>
          <td style="width: 50%;"><strong>Evaluator:</strong> ${
            evaluator?.name ? escapeHtml(formatInstructorName(evaluator.name)) : 'N/A'
          }</td>
        </tr>
        <tr>
          <td><strong>Skill:</strong> ${escapeHtml(
            skillSheet?.skill_name || 'N/A'
          )}</td>
          <td><strong>Lab Day:</strong> ${
            labDay?.title ? escapeHtml(labDay.title) : evalDate
          }</td>
        </tr>
        <tr>
          <td><strong>Mode:</strong> ${
            evaluation.evaluation_type === 'formative' ? 'Formative' : 'Final Competency'
          }</td>
          <td><strong>Source:</strong> ${escapeHtml(
            (skillSheet?.source || 'N/A').toUpperCase()
          )}</td>
        </tr>
      </table>

      <!-- Steps Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-bottom: 16px; background-color: #ffffff;">
        <thead>
          <tr style="background-color: #1e40af; color: white;">
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 40px;">#</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: left;">Description</th>
            ${
              isMultiPoint
                ? '<th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 50px;">Points</th>'
                : ''
            }
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 50px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${stepRows}
        </tbody>
      </table>

      <!-- Summary -->
      <table style="width: 100%; margin-bottom: 16px; font-size: 13px; color: #111827;">
        <tr>
          ${
            isMultiPoint
              ? `<td style="width: 33%;"><strong>Points:</strong> ${earnedPoints}/${totalPossiblePoints} (${
                  totalPossiblePoints > 0
                    ? Math.round((earnedPoints / totalPossiblePoints) * 100)
                    : 0
                }%)</td>`
              : `<td style="width: 33%;"><strong>Steps Completed:</strong> ${passedSteps}/${totalSteps}</td>`
          }
          <td style="width: 33%;"><strong>Critical Steps:</strong> ${criticalPassed}/${criticalSteps.length}</td>
          <td style="width: 33%;"><strong>Result:</strong> <span style="color: ${resultColor}; font-weight: 700; font-size: 15px;">${evaluation.result.toUpperCase()}</span></td>
        </tr>
      </table>

      ${
        criticalFailures.length > 0
          ? `
        <div style="border: 1px solid #fecaca; border-radius: 4px; padding: 10px; margin-bottom: 16px; font-size: 12px; background-color: #fef2f2;">
          <strong style="color: #dc2626;">Critical Failures:</strong>
          <ul style="margin: 4px 0 0 18px; padding: 0;">
            ${criticalFailures
              .map((f) => `<li style="color: #991b1b;">${escapeHtml(f)}</li>`)
              .join('')}
          </ul>
        </div>
      `
          : ''
      }

      ${
        evaluation.notes
          ? `
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 16px; background-color: #fafafa;">
          <strong style="font-size: 12px; color: #374151;">Comments:</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #4b5563;">${escapeHtml(
            evaluation.notes
          )}</p>
        </div>
      `
          : ''
      }

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

/**
 * Full HTML document shell used by both the single-skill print endpoint
 * and the student packet endpoint. Explicit white body + html background
 * so html2canvas never rasterizes a transparent (→ black in the PDF)
 * background.
 */
export function wrapPrintHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background-color: #ffffff !important;
      color: #111827;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    .page-break-before { page-break-before: always; }
    .eval-page { page-break-inside: avoid; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}
