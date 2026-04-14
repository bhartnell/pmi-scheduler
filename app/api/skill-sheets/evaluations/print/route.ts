import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import {
  renderEvaluationSection,
  wrapPrintHtml,
  escapeHtml,
  type EvalDataForPrint,
} from '@/lib/skillSheetPrintTemplate';

/**
 * Single-skill print / PDF endpoint.
 *
 * Query params:
 *   evaluation_id   Required. UUID of the student_skill_evaluations row.
 *   format          Optional. 'fragment' returns the bare eval section
 *                   HTML without the <html><body> shell, used by the
 *                   student-pdf packet endpoint to concatenate multiple
 *                   evaluations in one document.
 */
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
    const format = request.nextUrl.searchParams.get('format');
    if (!evaluationId) {
      return NextResponse.json({ success: false, error: 'evaluation_id is required' }, { status: 400 });
    }

    const { data: evaluation, error: evalError } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, notes, flagged_items, step_marks, created_at, is_retake,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, source, nremt_code, steps:skill_sheet_steps(step_number, phase, instruction, is_critical, possible_points, sub_items, section_header)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, title)
      `)
      .eq('id', evaluationId)
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json({ success: false, error: 'Evaluation not found' }, { status: 404 });
    }

    const student = (evaluation.student as unknown as { first_name?: string; last_name?: string }) || {};
    const skillSheet = (evaluation.skill_sheet as unknown as { skill_name?: string }) || {};

    const section = renderEvaluationSection(
      evaluation as unknown as EvalDataForPrint,
      { includePageBreak: false }
    );

    // Fragment mode: no doc shell, so the caller can compose multiple
    // sections into a single document (see student-pdf packet endpoint).
    if (format === 'fragment') {
      return new NextResponse(section, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const title = `Skill Evaluation — ${student.first_name || ''} ${student.last_name || ''} — ${skillSheet.skill_name || ''}`;
    const body = `
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
      Print / Save as PDF
    </button>
  </div>
  ${section}
`;
    const html = wrapPrintHtml(title, body);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generating print view:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate print view' }, { status: 500 });
  }
}

// Prevent unused-import complaints if the bundler strips dead code
void escapeHtml;
