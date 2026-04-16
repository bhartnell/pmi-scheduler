import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  renderEvaluationSection,
  wrapPrintHtml,
  escapeHtml,
  type EvalDataForPrint,
} from '@/lib/skillSheetPrintTemplate';
import JSZip from 'jszip';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/lab-management/lab-days/[id]/pdf-packet
 *
 * Returns a zip file containing one print-ready HTML document per student
 * who has evaluations on the given lab day. Each HTML file is identical to
 * the output of the single-student /student-pdf endpoint: PMI-branded,
 * white background, cover page with summary, full step-by-step tables,
 * page breaks between skills, and retake labels.
 *
 * Files are named per CreAM convention:
 *   NREMT_2026-04-15_LastName_FirstName.html
 *
 * The HTML files are print-ready — open in a browser and File → Print → Save
 * as PDF. Each file triggers window.print() automatically.
 *
 * Only includes students with status = 'active' (excludes withdrawn).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    // Suppress unused var lint — request is used by Next.js routing
    void request;

    // 1. Lab day + cohort info
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select(
        'id, date, title, is_nremt_testing, cohort:cohorts!lab_days_cohort_id_fkey(id, cohort_number, program:programs!cohorts_program_id_fkey(name, abbreviation))'
      )
      .eq('id', labDayId)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json(
        { success: false, error: 'Lab day not found' },
        { status: 404 }
      );
    }

    // 2. All evaluations for this lab day, grouped by student
    const { data: evaluations, error: evalsError } = await supabase
      .from('student_skill_evaluations')
      .select(
        `
        id, evaluation_type, result, notes, flagged_items, step_marks, created_at, is_retake, original_evaluation_id,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, status),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, nremt_code, steps:skill_sheet_steps(step_number, phase, instruction, is_critical, possible_points, sub_items, section_header)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `
      )
      .eq('lab_day_id', labDayId)
      .eq('status', 'complete')
      .order('created_at', { ascending: true });

    if (evalsError) {
      console.error('[pdf-packet] Eval query error:', evalsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch evaluations' },
        { status: 500 }
      );
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No evaluations found for this lab day' },
        { status: 404 }
      );
    }

    // 3. Group evaluations by student (exclude withdrawn students)
    const studentMap = new Map<
      string,
      {
        student: { id: string; first_name: string; last_name: string };
        evals: EvalDataForPrint[];
      }
    >();

    for (const ev of evaluations) {
      const student = ev.student as any;
      if (!student?.id) continue;
      // Exclude withdrawn students
      if (student.status === 'withdrawn') continue;

      if (!studentMap.has(student.id)) {
        studentMap.set(student.id, {
          student: {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
          },
          evals: [],
        });
      }
      studentMap.get(student.id)!.evals.push(ev as unknown as EvalDataForPrint);
    }

    // 4. Build HTML for each student (same logic as /student-pdf endpoint)
    const dateForFilename =
      labDay.date || new Date().toISOString().split('T')[0];
    const cohort = labDay.cohort as any;
    const labDate = labDay.date
      ? new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Unknown Date';

    const zip = new JSZip();

    for (const [, { student, evals }] of studentMap) {
      // Group by skill
      const skillGroups = new Map<string, EvalDataForPrint[]>();
      for (const ev of evals) {
        const skillName =
          ((ev.skill_sheet as any)?.skill_name as string) || 'Unknown';
        if (!skillGroups.has(skillName)) skillGroups.set(skillName, []);
        skillGroups.get(skillName)!.push(ev);
      }

      // Cover page summary
      let passedSkills = 0;
      const totalSkills = skillGroups.size;
      const skillSummaryRows: string[] = [];
      for (const [skillName, skillEvals] of skillGroups) {
        const bestResult = skillEvals.some((e) => e.result === 'pass')
          ? 'pass'
          : skillEvals[skillEvals.length - 1]?.result || 'incomplete';
        if (bestResult === 'pass') passedSkills++;
        const nremtCode = (skillEvals[0].skill_sheet as any)?.nremt_code;
        const hasRetake = skillEvals.some((e) => e.is_retake);
        const resultColor =
          bestResult === 'pass'
            ? '#10b981'
            : bestResult === 'fail'
              ? '#ef4444'
              : '#f59e0b';
        const resultLabel =
          bestResult === 'pass'
            ? 'PASS'
            : bestResult === 'fail'
              ? 'FAIL'
              : 'INCOMPLETE';
        skillSummaryRows.push(`
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 12px; font-size: 13px; color: #111827;">${escapeHtml(skillName)}${
              nremtCode
                ? ` <span style="color: #6b7280; font-size: 11px;">(${escapeHtml(nremtCode)})</span>`
                : ''
            }</td>
            <td style="padding: 8px 12px; text-align: center;"><span style="color: ${resultColor}; font-weight: 700; font-size: 13px;">${resultLabel}</span>${
              hasRetake
                ? ' <span style="background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">RETAKE</span>'
                : ''
            }</td>
            <td style="padding: 8px 12px; text-align: center; font-size: 12px; color: #6b7280;">${skillEvals.length}</td>
          </tr>
        `);
      }
      const allPassed = totalSkills > 0 && passedSkills === totalSkills;

      const coverSection = `
        <div style="text-align: center; padding: 40px 20px 30px 20px; background-color: #ffffff;">
          <h1 style="font-size: 24px; color: #1e40af; margin: 0 0 4px 0;">PMI Paramedic Program</h1>
          <h2 style="font-size: 16px; color: #6b7280; margin: 0 0 24px 0;">NREMT Skill Evaluation Report</h2>
          <div style="font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 4px;">
            ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}
          </div>
          ${
            cohort
              ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">${escapeHtml(cohort.program?.abbreviation || '')} Cohort ${cohort.cohort_number || ''}</div>`
              : ''
          }
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">${labDate}</div>
          ${
            labDay.title
              ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">${escapeHtml(labDay.title)}</div>`
              : '<div style="margin-bottom: 24px;"></div>'
          }
          <div style="display: inline-block; padding: 12px 32px; border-radius: 8px; font-size: 18px; font-weight: 700; ${
            allPassed
              ? 'background-color: #dcfce7; color: #166534; border: 2px solid #86efac;'
              : `background-color: ${passedSkills === 0 ? '#fef2f2' : '#fffbeb'}; color: ${passedSkills === 0 ? '#991b1b' : '#92400e'}; border: 2px solid ${passedSkills === 0 ? '#fecaca' : '#fde68a'};`
          }">
            ${allPassed ? 'ALL SKILLS PASSED' : `INCOMPLETE &mdash; ${passedSkills} of ${totalSkills} passed`}
          </div>
        </div>
        <div style="max-width: 500px; margin: 24px auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; background-color: #ffffff;">
            <thead>
              <tr style="background-color: #1e40af; color: white;">
                <th style="padding: 8px 12px; font-size: 11px; text-align: left;">Skill</th>
                <th style="padding: 8px 12px; font-size: 11px; text-align: center;">Result</th>
                <th style="padding: 8px 12px; font-size: 11px; text-align: center;">Attempts</th>
              </tr>
            </thead>
            <tbody>${skillSummaryRows.join('')}</tbody>
          </table>
        </div>
      `;

      // Evaluation sections
      let evalSections = '';
      for (const [, skillEvals] of skillGroups) {
        const hasRetake = skillEvals.some((e) => e.is_retake);
        for (const ev of skillEvals) {
          const attemptLabel = hasRetake
            ? ev.is_retake
              ? 'Retake Attempt'
              : 'Attempt 1'
            : '';
          evalSections += renderEvaluationSection(ev, {
            includePageBreak: true,
            attemptLabel,
          });
        }
      }

      // Print bar + auto-print script
      const printBar = `
        <div class="no-print" style="max-width: 820px; margin: 0 auto 16px auto; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
            Print / Save as PDF
          </button>
        </div>`;
      const autoPrintScript = `<script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });</script>`;

      const body = `${printBar}\n${coverSection}\n${evalSections}\n${autoPrintScript}`;
      const html = wrapPrintHtml(
        `NREMT Results — ${student.first_name} ${student.last_name}`,
        body
      );

      // Add to zip with CreAM-compatible filename
      const filename = `NREMT_${dateForFilename}_${student.last_name}_${student.first_name}.html`;
      zip.file(filename, html);
    }

    // 5. Generate zip
    const cohortLabel = cohort
      ? `Cohort${cohort.cohort_number || ''}`
      : 'Results';
    const zipFilename = `NREMT_${dateForFilename}_${cohortLabel}_Results.zip`;

    const zipArrayBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new Response(zipArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': String(zipArrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[pdf-packet] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF packet' },
      { status: 500 }
    );
  }
}
