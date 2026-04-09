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

    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch all complete evaluations for this lab day, including step_marks and skill steps
    const { data: evaluations, error } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, evaluation_type, result, email_status, attempt_number, team_role, notes, created_at,
        step_marks, critical_fail, critical_fail_notes, flagged_items,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name, email),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name, steps:skill_sheet_steps(step_number, possible_points, is_critical, sub_items)),
        evaluator:lab_users!student_skill_evaluations_evaluator_id_fkey(id, name)
      `)
      .eq('lab_day_id', labDayId)
      .eq('status', 'complete')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[skill-results] Query error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({
        success: true,
        students: [],
        skills: [],
        summary: { total_evals: 0, pass_count: 0, fail_count: 0, pass_rate: 0, by_skill: [] },
      });
    }

    // Helper to calculate points from step_marks
    function calcPoints(stepMarks: unknown, steps: Array<{ step_number: number; possible_points: number; is_critical: boolean; sub_items?: any[] | null }>) {
      const effPts = (s: { sub_items?: any[] | null; possible_points: number }) =>
        (s.sub_items && s.sub_items.length > 0) ? s.sub_items.length : (s.possible_points || 1);
      let earnedPoints = 0;
      const marks = (stepMarks || {}) as Record<string, unknown>;
      for (const [key, val] of Object.entries(marks)) {
        if (typeof val === 'string') {
          if (val === 'pass') {
            const step = steps.find((s) => String(s.step_number) === key);
            earnedPoints += step ? effPts(step) : 1;
          }
        } else if (typeof val === 'object' && val !== null) {
          earnedPoints += (val as { points?: number }).points || 0;
        }
      }
      const totalPossible = steps.reduce((sum, s) => sum + effPts(s), 0);
      return { earnedPoints, totalPossible };
    }

    // Group by student
    const studentMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      evaluations: Array<{
        id: string;
        skill_name: string;
        skill_id: string;
        result: string;
        evaluation_type: string;
        email_status: string;
        evaluator_name: string;
        attempt_number: number;
        team_role: string | null;
        notes: string | null;
        created_at: string;
        points_earned: number;
        points_possible: number;
        minimum_points: number | null;
        at_risk: boolean;
        critical_fail: boolean;
      }>;
    }>();

    const skillMap = new Map<string, string>(); // id -> skill_name
    let passCount = 0;
    let failCount = 0;
    const skillStats = new Map<string, {
      skill_name: string;
      pass_count: number;
      total: number;
      total_points_earned: number;
      total_possible: number;
      minimum_required: number | null;
    }>();

    for (const ev of evaluations) {
      const student = ev.student as any;
      const skillSheet = ev.skill_sheet as any;
      const evaluator = ev.evaluator as any;

      if (!student || !skillSheet) continue;

      const studentId = student.id as string;
      const studentName = `${student.last_name}, ${student.first_name}`;
      const skillId = skillSheet.id as string;
      const skillName = skillSheet.skill_name as string;
      const steps = skillSheet.steps || [];

      // Calculate points
      const { earnedPoints, totalPossible } = calcPoints(ev.step_marks, steps);
      const minimumPoints = findMinimumPoints(skillName);
      const atRisk = ev.result === 'pass' && minimumPoints !== null && earnedPoints <= minimumPoints + 3 && earnedPoints >= minimumPoints;
      const criticalFail = ev.critical_fail === true;

      // Track unique skills
      if (!skillMap.has(skillId)) {
        skillMap.set(skillId, skillName);
      }

      // Count pass/fail
      if (ev.result === 'pass') passCount++;
      else failCount++;

      // Per-skill stats
      if (!skillStats.has(skillId)) {
        skillStats.set(skillId, {
          skill_name: skillName,
          pass_count: 0,
          total: 0,
          total_points_earned: 0,
          total_possible: totalPossible,
          minimum_required: minimumPoints,
        });
      }
      const stat = skillStats.get(skillId)!;
      stat.total++;
      stat.total_points_earned += earnedPoints;
      if (ev.result === 'pass') stat.pass_count++;

      // Build student entry
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: studentId,
          name: studentName,
          email: student.email || '',
          evaluations: [],
        });
      }

      studentMap.get(studentId)!.evaluations.push({
        id: ev.id,
        skill_name: skillName,
        skill_id: skillId,
        result: ev.result,
        evaluation_type: ev.evaluation_type,
        email_status: ev.email_status,
        evaluator_name: evaluator?.name || 'Unknown',
        attempt_number: ev.attempt_number,
        team_role: ev.team_role,
        notes: ev.notes,
        created_at: ev.created_at,
        points_earned: earnedPoints,
        points_possible: totalPossible,
        minimum_points: minimumPoints,
        at_risk: atRisk,
        critical_fail: criticalFail,
      });
    }

    // Sort students by name
    const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Build skills array
    const skills = Array.from(skillMap.entries()).map(([id, skill_name]) => ({ id, skill_name }));

    // Build summary
    const totalEvals = passCount + failCount;
    const summary = {
      total_evals: totalEvals,
      pass_count: passCount,
      fail_count: failCount,
      pass_rate: totalEvals > 0 ? Math.round((passCount / totalEvals) * 100) : 0,
      by_skill: Array.from(skillStats.values()).map(s => ({
        skill_name: s.skill_name,
        pass_count: s.pass_count,
        total: s.total,
        pass_rate: s.total > 0 ? Math.round((s.pass_count / s.total) * 100) : 0,
        avg_points: s.total > 0 ? Math.round((s.total_points_earned / s.total) * 10) / 10 : 0,
        total_possible: s.total_possible,
        minimum_required: s.minimum_required,
      })),
    };

    return NextResponse.json({ success: true, students, skills, summary });
  } catch (err) {
    console.error('[skill-results] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
