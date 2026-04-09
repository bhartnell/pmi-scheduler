import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findMinimumPoints } from '@/lib/nremt-instructions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: studentId } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch all completed evaluations for this student across all lab days
    const { data: evaluations, error } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, email_status, attempt_number, team_role, notes, created_at,
        step_marks, critical_fail, critical_fail_notes, flagged_items,
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, steps:skill_sheet_steps(step_number, possible_points, is_critical, sub_items)),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, title, date),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name)
      `)
      .eq('student_id', studentId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[skill-history] Query error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch skill history' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({
        success: true,
        evaluations: [],
        summary: { total_attempts: 0, pass_count: 0, fail_count: 0, pass_rate: 0, skills_passed: 0, skills_attempted: 0 },
      });
    }

    let passCount = 0;
    let failCount = 0;
    const skillsPassed = new Set<string>();
    const skillsAttempted = new Set<string>();

    const mapped = evaluations.map((ev) => {
      const skillSheet = ev.skill_sheet as any;
      const labDay = ev.lab_day as any;
      const evaluator = ev.evaluator as any;
      const steps = skillSheet?.steps || [];
      const skillName = skillSheet?.skill_name || 'Unknown';

      // Calculate points
      const effPts = (s: any) => (s.sub_items && s.sub_items.length > 0) ? s.sub_items.length : (s.possible_points || 1);
      let earnedPoints = 0;
      const marks = (ev.step_marks || {}) as Record<string, unknown>;
      for (const [key, val] of Object.entries(marks)) {
        if (typeof val === 'string') {
          if (val === 'pass') {
            const step = steps.find((s: any) => String(s.step_number) === key);
            earnedPoints += step ? effPts(step) : 1;
          }
        } else if (typeof val === 'object' && val !== null) {
          earnedPoints += (val as any).points || 0;
        }
      }
      const totalPossible = steps.reduce((sum: number, s: any) => sum + effPts(s), 0);
      const minimumPoints = findMinimumPoints(skillName);
      const criticalFail = ev.critical_fail === true;

      // Track summary stats
      skillsAttempted.add(skillName);
      if (ev.result === 'pass') {
        passCount++;
        skillsPassed.add(skillName);
      } else {
        failCount++;
      }

      return {
        id: ev.id,
        skill_name: skillName,
        skill_id: skillSheet?.id || null,
        result: ev.result,
        evaluation_type: ev.evaluation_type,
        email_status: ev.email_status,
        points_earned: earnedPoints,
        points_possible: totalPossible,
        minimum_points: minimumPoints,
        critical_fail: criticalFail,
        critical_fail_notes: ev.critical_fail_notes,
        evaluator_name: evaluator?.name || 'Unknown',
        lab_day_title: labDay?.title || 'Unknown',
        lab_day_date: labDay?.date || null,
        lab_day_id: labDay?.id || null,
        attempt_number: ev.attempt_number,
        team_role: ev.team_role,
        notes: ev.notes,
        created_at: ev.created_at,
      };
    });

    const totalAttempts = passCount + failCount;
    const summary = {
      total_attempts: totalAttempts,
      pass_count: passCount,
      fail_count: failCount,
      pass_rate: totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0,
      skills_passed: skillsPassed.size,
      skills_attempted: skillsAttempted.size,
    };

    return NextResponse.json({ success: true, evaluations: mapped, summary });
  } catch (err) {
    console.error('[skill-history] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
