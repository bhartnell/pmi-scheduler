import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/lab-management/lab-days/[id]/retake-status
 *
 * Returns per-student retake eligibility for an NREMT testing day.
 *
 * For each student who has completed all first-attempt skills:
 * - Lists failed skills (by skill_sheet_id)
 * - Whether they're eligible for retake (1-3 fails) or must reschedule (4+)
 * - Whether they've already used their retake for each failed skill
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const { id: labDayId } = await params;
    const supabase = getSupabaseAdmin();

    // Get lab day info
    const { data: labDay, error: labDayErr } = await supabase
      .from('lab_days')
      .select('id, cohort_id, is_nremt_testing')
      .eq('id', labDayId)
      .single();

    if (labDayErr || !labDay) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    // Get all stations for this lab day to know how many skills exist
    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, skill_name, custom_title, metadata')
      .eq('lab_day_id', labDayId);

    // Get station-to-skill-sheet mapping
    const stationIds = (stations || []).map(s => s.id);
    const stationSkillSheetMap: Record<string, string> = {};
    const skillSheetToName: Record<string, string> = {};

    if (stationIds.length > 0) {
      // Check metadata for skill_sheet_id
      for (const s of (stations || [])) {
        const meta = s.metadata as Record<string, unknown> | null;
        if (meta?.skill_sheet_id) {
          stationSkillSheetMap[s.id] = meta.skill_sheet_id as string;
          skillSheetToName[meta.skill_sheet_id as string] = s.skill_name || s.custom_title || 'Unknown Skill';
        }
      }

      // Also check station_skills table
      const { data: stationSkills } = await supabase
        .from('station_skills')
        .select('station_id, skill:skills!station_skills_skill_id_fkey(id, skill_sheet_ids)')
        .in('station_id', stationIds);

      if (stationSkills) {
        for (const ss of stationSkills) {
          const skill = ss.skill as unknown as { id: string; skill_sheet_ids?: string[] } | null;
          if (skill?.skill_sheet_ids?.length && !stationSkillSheetMap[ss.station_id]) {
            stationSkillSheetMap[ss.station_id] = skill.skill_sheet_ids[0];
          }
        }
      }
    }

    // Total unique skill sheet IDs = total skills for this day
    const allSkillSheetIds = new Set(Object.values(stationSkillSheetMap));
    const totalSkills = allSkillSheetIds.size;

    // Get all evaluations for this lab day
    const { data: evaluations, error: evalErr } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id, student_id, skill_sheet_id, result, attempt_number, is_retake, original_evaluation_id, status,
        student:students!student_skill_evaluations_student_id_fkey(id, first_name, last_name),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(id, skill_name)
      `)
      .eq('lab_day_id', labDayId)
      .eq('status', 'complete');

    if (evalErr) {
      console.error('[retake-status] Query error:', evalErr);
      return NextResponse.json({ success: false, error: 'Failed to fetch evaluations' }, { status: 500 });
    }

    // Group evaluations by student
    const studentEvals = new Map<string, {
      name: string;
      evals: Array<{
        id: string;
        skill_sheet_id: string;
        skill_name: string;
        result: string;
        attempt_number: number;
        is_retake: boolean;
        original_evaluation_id: string | null;
      }>;
    }>();

    for (const ev of (evaluations || [])) {
      const student = ev.student as unknown as { id: string; first_name: string; last_name: string } | null;
      const skillSheet = ev.skill_sheet as unknown as { id: string; skill_name: string } | null;
      if (!student || !skillSheet) continue;

      if (!studentEvals.has(student.id)) {
        studentEvals.set(student.id, {
          name: `${student.first_name} ${student.last_name}`,
          evals: [],
        });
      }

      studentEvals.get(student.id)!.evals.push({
        id: ev.id,
        skill_sheet_id: skillSheet.id,
        skill_name: skillSheet.skill_name,
        result: ev.result,
        attempt_number: ev.attempt_number || 1,
        is_retake: ev.is_retake === true,
        original_evaluation_id: ev.original_evaluation_id || null,
      });
    }

    // Build retake status per student
    const retakeStatuses: Array<{
      student_id: string;
      student_name: string;
      total_skills: number;
      first_attempt_count: number;
      all_first_attempts_done: boolean;
      failed_skills: Array<{
        skill_sheet_id: string;
        skill_name: string;
        original_evaluation_id: string;
        retake_used: boolean;
        retake_result: string | null;
      }>;
      fail_count: number;
      eligible: boolean; // true = 1-3 fails, false = 4+ fails
      must_reschedule: boolean;
      status: 'testing' | 'retake_eligible' | 'must_reschedule' | 'all_passed' | 'retakes_complete';
    }> = [];

    for (const [studentId, data] of studentEvals) {
      // Get first attempts only (not retakes)
      const firstAttempts = data.evals.filter(e => !e.is_retake);

      // Unique skill sheet IDs tested in first attempts
      const firstAttemptSkills = new Set(firstAttempts.map(e => e.skill_sheet_id));
      const firstAttemptCount = firstAttemptSkills.size;
      const allFirstAttemptsDone = firstAttemptCount >= totalSkills;

      // Determine best result per skill from first attempts
      const skillBestResult = new Map<string, { result: string; evalId: string; skillName: string }>();
      for (const ev of firstAttempts) {
        const existing = skillBestResult.get(ev.skill_sheet_id);
        // Pass always wins
        if (!existing || (existing.result !== 'pass' && ev.result === 'pass')) {
          skillBestResult.set(ev.skill_sheet_id, {
            result: ev.result,
            evalId: ev.id,
            skillName: ev.skill_name,
          });
        }
      }

      // Get failed skills from first attempts
      const failedSkills: Array<{
        skill_sheet_id: string;
        skill_name: string;
        original_evaluation_id: string;
        retake_used: boolean;
        retake_result: string | null;
      }> = [];

      for (const [skillSheetId, best] of skillBestResult) {
        if (best.result === 'fail') {
          // Check if retake exists
          const retakeEval = data.evals.find(
            e => e.is_retake && e.skill_sheet_id === skillSheetId
          );

          failedSkills.push({
            skill_sheet_id: skillSheetId,
            skill_name: best.skillName,
            original_evaluation_id: best.evalId,
            retake_used: !!retakeEval,
            retake_result: retakeEval?.result || null,
          });
        }
      }

      const failCount = failedSkills.length;
      const eligible = failCount >= 1 && failCount <= 3;
      const mustReschedule = failCount >= 4;

      // Determine overall status
      let status: 'testing' | 'retake_eligible' | 'must_reschedule' | 'all_passed' | 'retakes_complete';
      if (!allFirstAttemptsDone) {
        status = 'testing';
      } else if (failCount === 0) {
        status = 'all_passed';
      } else if (mustReschedule) {
        status = 'must_reschedule';
      } else if (failedSkills.every(s => s.retake_used)) {
        status = 'retakes_complete';
      } else {
        status = 'retake_eligible';
      }

      retakeStatuses.push({
        student_id: studentId,
        student_name: data.name,
        total_skills: totalSkills,
        first_attempt_count: firstAttemptCount,
        all_first_attempts_done: allFirstAttemptsDone,
        failed_skills: failedSkills,
        fail_count: failCount,
        eligible,
        must_reschedule: mustReschedule,
        status,
      });
    }

    // Also include students with no evaluations yet (still testing)
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', labDay.cohort_id)
      .eq('status', 'active');

    for (const student of (allStudents || [])) {
      if (!studentEvals.has(student.id)) {
        retakeStatuses.push({
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          total_skills: totalSkills,
          first_attempt_count: 0,
          all_first_attempts_done: false,
          failed_skills: [],
          fail_count: 0,
          eligible: false,
          must_reschedule: false,
          status: 'testing',
        });
      }
    }

    return NextResponse.json({
      success: true,
      total_skills: totalSkills,
      retake_statuses: retakeStatuses,
    });
  } catch (error) {
    console.error('[retake-status] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate retake status' },
      { status: 500 }
    );
  }
}
