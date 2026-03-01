import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─────────────────────────────────────────────────
// Default grade weights (must sum to 100)
// ─────────────────────────────────────────────────
const DEFAULT_WEIGHTS = {
  scenarios: 30,
  skills: 25,
  clinical: 20,
  attendance: 15,
  peerEvals: 10,
};

// ─────────────────────────────────────────────────
// Letter grade helper
// ─────────────────────────────────────────────────
function letterGrade(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

// ─────────────────────────────────────────────────
// GET /api/reports/gradebook?cohortId=X
// Returns aggregated grade data for every student in the cohort.
// ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify instructor+ role
    const { data: requestingUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!requestingUser || !hasMinRole(requestingUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
    }

    // ── 1. Cohort info ────────────────────────────────────────────
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, program:programs(name, abbreviation)')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }

    // ── 2. Active students ────────────────────────────────────────
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name')
      .order('first_name');

    if (studentsError) throw studentsError;

    const studentList = students || [];
    const studentIds = studentList.map((s) => s.id);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        cohort: buildCohortMeta(cohort),
        weights: DEFAULT_WEIGHTS,
        students: [],
      });
    }

    // ── 3. Parallel data fetches ──────────────────────────────────
    const [
      scenarioResult,
      skillResult,
      clinicalResult,
      attendanceLabDaysResult,
      peerEvalResult,
    ] = await Promise.all([
      // Scenario assessments: avg overall_score per student as team_lead_id
      // overall_score is out of 5 from the criteria_ratings count of satisfactory
      supabase
        .from('scenario_assessments')
        .select('team_lead_id, overall_score')
        .eq('cohort_id', cohortId)
        .in('team_lead_id', studentIds),

      // Skill signoffs: count of non-revoked signoffs per student
      supabase
        .from('skill_signoffs')
        .select('student_id')
        .in('student_id', studentIds)
        .is('revoked_at', null),

      // Clinical hours: total_hours per student
      supabase
        .from('student_clinical_hours')
        .select('student_id, total_hours')
        .in('student_id', studentIds),

      // Attendance: need lab days for the cohort first to compute rates
      supabase
        .from('lab_days')
        .select('id')
        .eq('cohort_id', cohortId),

      // Peer evaluations: avg of 3 scores per evaluated student
      supabase
        .from('peer_evaluations')
        .select('evaluated_id, communication_score, teamwork_score, leadership_score')
        .in('evaluated_id', studentIds)
        .eq('is_self_eval', false),
    ]);

    if (scenarioResult.error) throw scenarioResult.error;
    if (skillResult.error) throw skillResult.error;
    if (clinicalResult.error) throw clinicalResult.error;
    if (attendanceLabDaysResult.error) throw attendanceLabDaysResult.error;
    if (peerEvalResult.error) throw peerEvalResult.error;

    const labDayIds = (attendanceLabDaysResult.data || []).map((d) => d.id);
    const totalLabDays = labDayIds.length;

    // Fetch attendance records only if there are lab days
    let attendanceRecords: Array<{ student_id: string; status: string }> = [];
    if (labDayIds.length > 0) {
      const { data: attData, error: attError } = await supabase
        .from('lab_day_attendance')
        .select('student_id, status')
        .in('lab_day_id', labDayIds)
        .in('student_id', studentIds);

      if (attError) throw attError;
      attendanceRecords = attData || [];
    }

    // ── 4. Build per-student aggregate maps ───────────────────────

    // Scenarios: sum and count of overall_score per student
    const scenarioMap = new Map<string, { sum: number; count: number }>();
    for (const rec of scenarioResult.data || []) {
      const sid = rec.team_lead_id;
      if (!sid) continue;
      const entry = scenarioMap.get(sid) || { sum: 0, count: 0 };
      entry.sum += rec.overall_score ?? 0;
      entry.count += 1;
      scenarioMap.set(sid, entry);
    }

    // Skills: count of signoffs per student
    const skillMap = new Map<string, number>();
    for (const rec of skillResult.data || []) {
      skillMap.set(rec.student_id, (skillMap.get(rec.student_id) || 0) + 1);
    }

    // Clinical: total_hours per student
    const clinicalMap = new Map<string, number>();
    for (const rec of clinicalResult.data || []) {
      clinicalMap.set(rec.student_id, rec.total_hours ?? 0);
    }

    // Attendance: count present/late per student
    const attendanceMap = new Map<string, { present: number; total: number }>();
    for (const studentId of studentIds) {
      attendanceMap.set(studentId, { present: 0, total: totalLabDays });
    }
    for (const rec of attendanceRecords) {
      const entry = attendanceMap.get(rec.student_id);
      if (!entry) continue;
      if (rec.status === 'present' || rec.status === 'late') {
        entry.present += 1;
      }
      attendanceMap.set(rec.student_id, entry);
    }

    // Peer evals: avg of all three scores per evaluated student
    const peerMap = new Map<string, { sum: number; count: number }>();
    for (const rec of peerEvalResult.data || []) {
      const sid = rec.evaluated_id;
      const avgScore = ((rec.communication_score ?? 0) + (rec.teamwork_score ?? 0) + (rec.leadership_score ?? 0)) / 3;
      const entry = peerMap.get(sid) || { sum: 0, count: 0 };
      entry.sum += avgScore;
      entry.count += 1;
      peerMap.set(sid, entry);
    }

    // Cohort-level denominators for normalizing scores to 0-100%
    // Skills: use max signoffs in cohort as the ceiling (or minimum 1 to avoid div/0)
    const maxSkillSignoffs = Math.max(1, ...Array.from(skillMap.values()), 1);

    // Clinical: use the highest total hours in cohort (or minimum 1)
    const maxClinicalHours = Math.max(1, ...Array.from(clinicalMap.values()), 1);

    // Scenario: overall_score is on a scale of 0-5 per assessment, so we normalize to 0-100
    // by dividing avg score by 5 and multiplying by 100.
    // Skills: expressed as % of top performer in cohort.
    // Clinical: expressed as % of top performer.
    // Peer evals: avg of 1-5 scores -> /5 * 100.

    // ── 5. Build student rows ──────────────────────────────────────
    const gradeRows = studentList.map((student) => {
      // --- Scenarios ---
      const scenarioEntry = scenarioMap.get(student.id);
      const scenarioAvgRaw = scenarioEntry && scenarioEntry.count > 0
        ? scenarioEntry.sum / scenarioEntry.count
        : null;
      // Normalize: overall_score is a raw count of satisfactory criteria (0-5 typically)
      // Express as percentage of max possible (5)
      const scenarioPct = scenarioAvgRaw !== null
        ? Math.min(100, Math.round((scenarioAvgRaw / 5) * 100))
        : null;
      const scenarioCount = scenarioEntry?.count ?? 0;

      // --- Skills ---
      const skillCount = skillMap.get(student.id) ?? 0;
      // Normalize as % of top performer
      const skillPct = Math.round((skillCount / maxSkillSignoffs) * 100);

      // --- Clinical ---
      const clinicalHours = clinicalMap.get(student.id) ?? 0;
      const clinicalPct = Math.round((clinicalHours / maxClinicalHours) * 100);

      // --- Attendance ---
      const attEntry = attendanceMap.get(student.id) || { present: 0, total: 0 };
      const attendancePct = attEntry.total > 0
        ? Math.round((attEntry.present / attEntry.total) * 100)
        : null;

      // --- Peer Evals ---
      const peerEntry = peerMap.get(student.id);
      const peerAvgRaw = peerEntry && peerEntry.count > 0
        ? peerEntry.sum / peerEntry.count
        : null;
      const peerPct = peerAvgRaw !== null
        ? Math.min(100, Math.round((peerAvgRaw / 5) * 100))
        : null;

      // --- Weighted overall ---
      // Only include categories with actual data in the weighted average
      let weightedSum = 0;
      let weightUsed = 0;

      if (scenarioPct !== null) {
        weightedSum += scenarioPct * DEFAULT_WEIGHTS.scenarios;
        weightUsed += DEFAULT_WEIGHTS.scenarios;
      }
      // Skills always has a value (0 if none)
      weightedSum += skillPct * DEFAULT_WEIGHTS.skills;
      weightUsed += DEFAULT_WEIGHTS.skills;

      // Clinical: only count if there is any clinical data in the cohort
      if (maxClinicalHours > 1) {
        weightedSum += clinicalPct * DEFAULT_WEIGHTS.clinical;
        weightUsed += DEFAULT_WEIGHTS.clinical;
      }

      if (attendancePct !== null) {
        weightedSum += attendancePct * DEFAULT_WEIGHTS.attendance;
        weightUsed += DEFAULT_WEIGHTS.attendance;
      }

      if (peerPct !== null) {
        weightedSum += peerPct * DEFAULT_WEIGHTS.peerEvals;
        weightUsed += DEFAULT_WEIGHTS.peerEvals;
      }

      const overallPct = weightUsed > 0 ? Math.round(weightedSum / weightUsed) : 0;
      const grade = letterGrade(overallPct);

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        // Raw values
        scenarioAvgRaw,
        scenarioCount,
        skillCount,
        clinicalHours,
        attendancePresent: attEntry.present,
        attendanceTotal: attEntry.total,
        peerAvgRaw,
        // Percentage scores (0-100)
        scenarioPct,
        skillPct,
        clinicalPct,
        attendancePct,
        peerPct,
        // Composite
        overallPct,
        grade,
        belowPassing: overallPct < 70,
      };
    });

    // ── 6. Cohort summary stats ───────────────────────────────────
    const passing = gradeRows.filter((r) => r.overallPct >= 70).length;
    const failing = gradeRows.filter((r) => r.overallPct < 70).length;
    const avgOverall = gradeRows.length > 0
      ? Math.round(gradeRows.reduce((s, r) => s + r.overallPct, 0) / gradeRows.length)
      : 0;

    return NextResponse.json({
      success: true,
      cohort: buildCohortMeta(cohort),
      weights: DEFAULT_WEIGHTS,
      summary: {
        totalStudents: gradeRows.length,
        totalLabDays,
        passing,
        failing,
        avgOverall,
      },
      students: gradeRows,
    });
  } catch (error) {
    console.error('Error generating gradebook:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate gradebook' }, { status: 500 });
  }
}

function buildCohortMeta(cohort: any) {
  const programAbbr = (cohort.program as any)?.abbreviation || 'Unknown';
  return {
    id: cohort.id,
    name: `${programAbbr} Group ${cohort.cohort_number}`,
    programAbbreviation: programAbbr,
    cohortNumber: cohort.cohort_number,
  };
}
