import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  renderEvaluationSection,
  wrapPrintHtml,
  escapeHtml,
  type EvalDataForPrint,
} from '@/lib/skillSheetPrintTemplate';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Student packet PDF endpoint.
 *
 * Returns a single HTML document containing a cover page plus one
 * clean-format skill evaluation section per evaluation the student
 * completed on the given lab day. The HTML is consumed by
 * lib/nremtExport.ts, which rasterizes it inside a hidden iframe and
 * saves as `NREMT_<date>_<Last>_<First>.pdf`.
 *
 * Each section is rendered via the shared lib/skillSheetPrintTemplate
 * module (same source of truth as the single-skill print endpoint), so
 * the full student packet now visually matches the individual Print
 * Score Sheet output: white background, PMI-branded header, full
 * step-by-step table per skill, signature lines, and clean typography.
 */
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

    // 1. Lab day + cohort/program info for the cover page
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select('id, date, title, is_nremt_testing, cohort:cohorts!lab_days_cohort_id_fkey(id, cohort_number, program:programs!cohorts_program_id_fkey(name, abbreviation))')
      .eq('id', labDayId)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    // 2. Student info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    // 3. Every evaluation the student has for this lab day, newest last,
    //    with the nested student/skill_sheet/evaluator/lab_day fields
    //    required by the shared template.
    const { data: evaluations, error: evalsError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, flagged_items, step_marks, created_at, is_retake, original_evaluation_id,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, nremt_code, steps:skill_sheet_steps(step_number, phase, instruction, is_critical, possible_points, sub_items, section_header)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('lab_day_id', labDayId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (evalsError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    const dateForFilename = labDay.date || new Date().toISOString().split('T')[0];
    const cdHeader = `inline; filename="NREMT_${dateForFilename}_${student.last_name}_${student.first_name}.pdf"`;

    // 4. No evaluations → return a friendly placeholder (still white bg)
    if (!evaluations || evaluations.length === 0) {
      const emptyBody = `
  <div style="text-align: center; padding: 60px 20px;">
    <h1 style="font-size: 20px; color: #6b7280;">No Evaluations Found</h1>
    <p style="color: #9ca3af; margin-top: 8px;">${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)} has no evaluations for this lab day.</p>
  </div>`;
      const emptyHtml = wrapPrintHtml(
        `NREMT Results — ${student.first_name} ${student.last_name}`,
        emptyBody
      );
      return new NextResponse(emptyHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': cdHeader,
        },
      });
    }

    // 5. Group by skill to compute the cover summary and detect retakes.
    const skillGroups = new Map<string, EvalDataForPrint[]>();
    for (const ev of evaluations) {
      const skillName = ((ev.skill_sheet as any)?.skill_name as string) || 'Unknown';
      if (!skillGroups.has(skillName)) skillGroups.set(skillName, []);
      skillGroups.get(skillName)!.push(ev as unknown as EvalDataForPrint);
    }

    let passedSkills = 0;
    const totalSkills = skillGroups.size;
    const skillSummaryRows: string[] = [];
    for (const [skillName, evals] of skillGroups) {
      const bestResult = evals.some((e) => e.result === 'pass')
        ? 'pass'
        : evals[evals.length - 1]?.result || 'incomplete';
      if (bestResult === 'pass') passedSkills++;
      const nremtCode = (evals[0].skill_sheet as any)?.nremt_code;
      const hasRetake = evals.some((e) => e.is_retake);
      const resultColor =
        bestResult === 'pass' ? '#10b981' : bestResult === 'fail' ? '#ef4444' : '#f59e0b';
      const resultLabel =
        bestResult === 'pass' ? 'PASS' : bestResult === 'fail' ? 'FAIL' : 'INCOMPLETE';
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
          <td style="padding: 8px 12px; text-align: center; font-size: 12px; color: #6b7280;">${evals.length}</td>
        </tr>
      `);
    }
    const allPassed = totalSkills > 0 && passedSkills === totalSkills;

    const labDate = labDay.date
      ? new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Unknown Date';
    const cohort = labDay.cohort as any;

    // 6. Cover page — white background, PMI branding, overall status badge,
    //    summary table of all skills with attempts/retake counts.
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
            : `background-color: ${
                passedSkills === 0 ? '#fef2f2' : '#fffbeb'
              }; color: ${
                passedSkills === 0 ? '#991b1b' : '#92400e'
              }; border: 2px solid ${
                passedSkills === 0 ? '#fecaca' : '#fde68a'
              };`
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
          <tbody>
            ${skillSummaryRows.join('')}
          </tbody>
        </table>
      </div>
    `;

    // 7. One clean-format section per evaluation, page-breaks between.
    //    Preserves the order within each skill so retakes follow first
    //    attempts and the attempt label is visually clear.
    let evalSections = '';
    for (const [, evals] of skillGroups) {
      const hasRetake = evals.some((e) => e.is_retake);
      for (let i = 0; i < evals.length; i++) {
        const ev = evals[i];
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

    // 8. Wrap cover + all sections in a single white-background document.
    const body = `
  ${coverSection}
  ${evalSections}
`;
    const html = wrapPrintHtml(
      `NREMT Results — ${student.first_name} ${student.last_name}`,
      body
    );

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': cdHeader,
      },
    });
  } catch (error) {
    console.error('Error generating student PDF:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate student PDF' }, { status: 500 });
  }
}
