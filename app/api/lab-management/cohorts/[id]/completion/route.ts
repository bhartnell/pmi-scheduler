import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const REQUIRED_CLINICAL_HOURS = 290;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: cohortId } = await params;

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

  try {
    // 1. Fetch cohort details
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        start_date,
        expected_end_date,
        is_active,
        program:programs(id, name, abbreviation)
      `)
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // 2. Fetch active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, agency')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name');

    if (studentsError) throw studentsError;

    const studentList = students || [];
    const studentIds = studentList.map(s => s.id);

    if (studentIds.length === 0) {
      const cohortData = cohort as any;
      const programData = cohortData.program;
      return NextResponse.json({
        success: true,
        cohort: {
          id: cohort.id,
          cohort_number: cohort.cohort_number,
          start_date: cohort.start_date,
          expected_end_date: cohort.expected_end_date,
          is_active: cohort.is_active,
          program: programData,
          label: programData ? `${programData.abbreviation} Group ${cohort.cohort_number}` : `Group ${cohort.cohort_number}`,
        },
        students: [],
        cohortStats: {
          totalStudents: 0,
          skillsPercent: 0,
          scenariosPercent: 0,
          clinicalHoursPercent: 0,
          overallPercent: 0,
          categoryBreakdown: [],
        },
        requiredClinicalHours: REQUIRED_CLINICAL_HOURS,
      });
    }

    // 3. Fetch all active stations from station_pool
    const { data: allStations } = await supabase
      .from('station_pool')
      .select('id, station_code, station_name, category, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const stations = allStations || [];
    const totalStations = stations.length;

    // 4. Fetch station_completions for all students in cohort
    let completions: any[] = [];
    if (studentIds.length > 0) {
      const { data: completionsData } = await supabase
        .from('station_completions')
        .select('student_id, station_id, result, completed_at')
        .in('student_id', studentIds);
      completions = completionsData || [];
    }

    // 5. Fetch scenario assessments (team lead scenarios) for all students
    let scenarioAssessments: any[] = [];
    if (studentIds.length > 0) {
      const { data: scenarioData } = await supabase
        .from('scenario_assessments')
        .select(`
          id,
          team_lead_id,
          overall_score,
          created_at,
          station:lab_stations!lab_station_id(
            station_number,
            scenario:scenarios(title, category)
          )
        `)
        .in('team_lead_id', studentIds);
      scenarioAssessments = scenarioData || [];
    }

    // 6. Fetch clinical hours for all students (wide-format: one row per student)
    let clinicalHoursRecords: any[] = [];
    if (studentIds.length > 0) {
      const { data: hoursData } = await supabase
        .from('student_clinical_hours')
        .select('student_id, total_hours')
        .in('student_id', studentIds);
      clinicalHoursRecords = hoursData || [];
    }

    // Build lookup maps
    // station completions: student_id -> station_id -> latest result
    const completionsByStudent: Record<string, Record<string, string>> = {};
    for (const c of completions) {
      if (!completionsByStudent[c.student_id]) {
        completionsByStudent[c.student_id] = {};
      }
      // Keep latest completion for each station (completions are not ordered, use date comparison)
      const existing = completionsByStudent[c.student_id][c.station_id];
      if (!existing || c.completed_at > existing) {
        completionsByStudent[c.student_id][c.station_id] = c.result;
      }
    }

    // scenario assessments: student_id -> list of scores
    const scenariosByStudent: Record<string, number[]> = {};
    for (const sa of scenarioAssessments) {
      if (!scenariosByStudent[sa.team_lead_id]) {
        scenariosByStudent[sa.team_lead_id] = [];
      }
      if (sa.overall_score !== null && sa.overall_score !== undefined) {
        scenariosByStudent[sa.team_lead_id].push(sa.overall_score);
      }
    }

    // clinical hours: student_id -> total_hours
    const clinicalHoursByStudent: Record<string, number> = {};
    for (const h of clinicalHoursRecords) {
      clinicalHoursByStudent[h.student_id] = h.total_hours || 0;
    }

    // -----------------------------------------------
    // Build category breakdown (cohort-level)
    // -----------------------------------------------
    // Aggregate categories from station_pool
    const categoryMap: Record<string, { total: number; completed: number }> = {};
    for (const station of stations) {
      const cat = station.category || 'other';
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, completed: 0 };
      categoryMap[cat].total += studentList.length; // each student needs to complete each station
    }

    // Now count passes per category across all students
    for (const student of studentList) {
      const studentCompletions = completionsByStudent[student.id] || {};
      for (const station of stations) {
        const cat = station.category || 'other';
        if (studentCompletions[station.id] === 'pass') {
          categoryMap[cat].completed++;
        }
      }
    }

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, counts]) => ({
        category,
        total: counts.total,
        completed: counts.completed,
        percent: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    // -----------------------------------------------
    // Per-student calculations
    // -----------------------------------------------
    const studentRows = studentList.map(student => {
      const studentCompletions = completionsByStudent[student.id] || {};

      // Skills: count of stations where student has a "pass" result
      const passedStations = stations.filter(s => studentCompletions[s.id] === 'pass').length;
      const skillsPercent = totalStations > 0 ? Math.round((passedStations / totalStations) * 100) : 0;

      // Scenarios: average score as a percentage (scores are 1-5 scale, 5 max)
      // We treat "completed a scenario" as having any assessment recorded
      const studentScenarios = scenariosByStudent[student.id] || [];
      const scenariosCompleted = studentScenarios.length;
      // Use score average / 5 as percent if scores exist, else 0
      const scenariosAvgScore = scenariosCompleted > 0
        ? studentScenarios.reduce((sum, s) => sum + s, 0) / scenariosCompleted
        : 0;
      const scenariosPercent = scenariosCompleted > 0
        ? Math.round((scenariosAvgScore / 5) * 100)
        : 0;

      // Clinical hours
      const totalHours = clinicalHoursByStudent[student.id] || 0;
      const clinicalHoursPercent = Math.min(100, Math.round((totalHours / REQUIRED_CLINICAL_HOURS) * 100));

      // Overall: weighted average (skills 40%, scenarios 30%, clinical hours 30%)
      const overallPercent = Math.round(
        skillsPercent * 0.4 + scenariosPercent * 0.3 + clinicalHoursPercent * 0.3
      );

      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        agency: student.agency,
        skillsCompleted: passedStations,
        skillsTotal: totalStations,
        skillsPercent,
        scenariosCompleted,
        scenariosPercent,
        clinicalHours: totalHours,
        clinicalHoursRequired: REQUIRED_CLINICAL_HOURS,
        clinicalHoursPercent,
        overallPercent,
        atRisk: overallPercent < 70,
      };
    });

    // Sort by overall percent ascending (at-risk students first)
    studentRows.sort((a, b) => a.overallPercent - b.overallPercent);

    // -----------------------------------------------
    // Cohort-level aggregates
    // -----------------------------------------------
    const n = studentRows.length;
    const cohortSkillsPercent = n > 0
      ? Math.round(studentRows.reduce((sum, s) => sum + s.skillsPercent, 0) / n)
      : 0;
    const cohortScenariosPercent = n > 0
      ? Math.round(studentRows.reduce((sum, s) => sum + s.scenariosPercent, 0) / n)
      : 0;
    const cohortClinicalHoursPercent = n > 0
      ? Math.round(studentRows.reduce((sum, s) => sum + s.clinicalHoursPercent, 0) / n)
      : 0;
    const cohortOverallPercent = n > 0
      ? Math.round(studentRows.reduce((sum, s) => sum + s.overallPercent, 0) / n)
      : 0;

    const cohortData = cohort as any;
    const programData = cohortData.program;

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        cohort_number: cohort.cohort_number,
        start_date: cohort.start_date,
        expected_end_date: cohort.expected_end_date,
        is_active: cohort.is_active,
        program: programData,
        label: programData ? `${programData.abbreviation} Group ${cohort.cohort_number}` : `Group ${cohort.cohort_number}`,
      },
      students: studentRows,
      cohortStats: {
        totalStudents: n,
        skillsPercent: cohortSkillsPercent,
        scenariosPercent: cohortScenariosPercent,
        clinicalHoursPercent: cohortClinicalHoursPercent,
        overallPercent: cohortOverallPercent,
        categoryBreakdown,
        totalStations,
      },
      requiredClinicalHours: REQUIRED_CLINICAL_HOURS,
    });
  } catch (error) {
    console.error('Error fetching cohort completion data:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch completion data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
