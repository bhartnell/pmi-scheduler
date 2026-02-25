import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const REQUIRED_CLINICAL_HOURS = 290;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Verify caller has lead_instructor+ role
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { cohort_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { cohort_ids } = body;

  if (!cohort_ids || !Array.isArray(cohort_ids) || cohort_ids.length < 2 || cohort_ids.length > 4) {
    return NextResponse.json(
      { error: 'cohort_ids must be an array of 2-4 cohort IDs' },
      { status: 400 }
    );
  }

  try {
    // Fetch cohort details for all selected cohorts
    const { data: cohortsData, error: cohortsError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        start_date,
        expected_end_date,
        is_active,
        program:programs(id, name, abbreviation)
      `)
      .in('id', cohort_ids);

    if (cohortsError) throw cohortsError;
    if (!cohortsData || cohortsData.length === 0) {
      return NextResponse.json({ error: 'No cohorts found' }, { status: 404 });
    }

    // Fetch all active stations once (shared across cohorts)
    const { data: allStations } = await supabase
      .from('station_pool')
      .select('id, station_code, station_name, category, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const stations = allStations || [];
    const totalStations = stations.length;

    // Build results per cohort
    const results = await Promise.all(
      cohortsData.map(async (cohort: any) => {
        const cohortId = cohort.id;
        const programData = cohort.program as any;
        const label = programData
          ? `${programData.abbreviation} Group ${cohort.cohort_number}`
          : `Group ${cohort.cohort_number}`;

        // Fetch active students in cohort
        const { data: students } = await supabase
          .from('students')
          .select('id')
          .eq('cohort_id', cohortId)
          .eq('status', 'active');

        const studentList = students || [];
        const studentIds = studentList.map((s: any) => s.id);
        const studentCount = studentIds.length;

        if (studentCount === 0) {
          return {
            cohort_id: cohortId,
            label,
            cohort_number: cohort.cohort_number,
            start_date: cohort.start_date,
            expected_end_date: cohort.expected_end_date,
            is_active: cohort.is_active,
            program: programData,
            studentCount: 0,
            skillsPercent: 0,
            scenariosPercent: 0,
            clinicalHoursPercent: 0,
            overallPercent: 0,
          };
        }

        // Fetch station completions for all students in this cohort
        const { data: completionsData } = await supabase
          .from('station_completions')
          .select('student_id, station_id, result, completed_at')
          .in('student_id', studentIds);

        const completions = completionsData || [];

        // Build completion map: student_id -> station_id -> result (keep latest)
        const completionsByStudent: Record<string, Record<string, string>> = {};
        for (const c of completions) {
          if (!completionsByStudent[c.student_id]) {
            completionsByStudent[c.student_id] = {};
          }
          const existing = completionsByStudent[c.student_id][c.station_id];
          if (!existing || c.completed_at > existing) {
            completionsByStudent[c.student_id][c.station_id] = c.result;
          }
        }

        // Fetch scenario assessments for all students in this cohort
        const { data: scenarioData } = await supabase
          .from('scenario_assessments')
          .select('team_lead_id, overall_score')
          .in('team_lead_id', studentIds);

        const scenarioAssessments = scenarioData || [];

        // Build scenario map: student_id -> scores[]
        const scenariosByStudent: Record<string, number[]> = {};
        for (const sa of scenarioAssessments) {
          if (!scenariosByStudent[sa.team_lead_id]) {
            scenariosByStudent[sa.team_lead_id] = [];
          }
          if (sa.overall_score !== null && sa.overall_score !== undefined) {
            scenariosByStudent[sa.team_lead_id].push(sa.overall_score);
          }
        }

        // Fetch clinical hours for all students in this cohort
        const { data: hoursData } = await supabase
          .from('student_clinical_hours')
          .select('student_id, total_hours')
          .in('student_id', studentIds);

        const clinicalHoursByStudent: Record<string, number> = {};
        for (const h of hoursData || []) {
          clinicalHoursByStudent[h.student_id] = h.total_hours || 0;
        }

        // Per-student calculations
        let totalSkillsPercent = 0;
        let totalScenariosPercent = 0;
        let totalClinicalPercent = 0;
        let totalOverallPercent = 0;

        for (const student of studentList) {
          const sid = student.id;
          const studentCompletions = completionsByStudent[sid] || {};

          // Skills: passed stations / total stations
          const passedStations = stations.filter((s: any) => studentCompletions[s.id] === 'pass').length;
          const skillsPercent = totalStations > 0 ? Math.round((passedStations / totalStations) * 100) : 0;

          // Scenarios: avg score / 5 as %
          const studentScenarios = scenariosByStudent[sid] || [];
          const scenariosCompleted = studentScenarios.length;
          const scenariosAvgScore =
            scenariosCompleted > 0
              ? studentScenarios.reduce((sum, s) => sum + s, 0) / scenariosCompleted
              : 0;
          const scenariosPercent =
            scenariosCompleted > 0 ? Math.round((scenariosAvgScore / 5) * 100) : 0;

          // Clinical hours: total_hours / 290, capped at 100
          const totalHours = clinicalHoursByStudent[sid] || 0;
          const clinicalHoursPercent = Math.min(
            100,
            Math.round((totalHours / REQUIRED_CLINICAL_HOURS) * 100)
          );

          // Overall: skills 40% + scenarios 30% + clinical 30%
          const overallPercent = Math.round(
            skillsPercent * 0.4 + scenariosPercent * 0.3 + clinicalHoursPercent * 0.3
          );

          totalSkillsPercent += skillsPercent;
          totalScenariosPercent += scenariosPercent;
          totalClinicalPercent += clinicalHoursPercent;
          totalOverallPercent += overallPercent;
        }

        const n = studentCount;
        return {
          cohort_id: cohortId,
          label,
          cohort_number: cohort.cohort_number,
          start_date: cohort.start_date,
          expected_end_date: cohort.expected_end_date,
          is_active: cohort.is_active,
          program: programData,
          studentCount: n,
          skillsPercent: Math.round(totalSkillsPercent / n),
          scenariosPercent: Math.round(totalScenariosPercent / n),
          clinicalHoursPercent: Math.round(totalClinicalPercent / n),
          overallPercent: Math.round(totalOverallPercent / n),
        };
      })
    );

    // Return results in the same order as cohort_ids input
    const orderedResults = cohort_ids.map(
      (id) => results.find((r) => r.cohort_id === id) || null
    ).filter(Boolean);

    return NextResponse.json({ success: true, comparisons: orderedResults });
  } catch (error) {
    console.error('Error generating cohort comparison:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate comparison';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
