import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: studentId } = await params;

  const supabase = getSupabaseAdmin();

  // Determine requesting user role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('id, role, email')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';

  // Access control: instructor+ can view any student; students can only view themselves
  // Students link their lab_users record to a students record via email
  if (!hasMinRole(userRole, 'instructor')) {
    // Allow students to see their own progress by matching email
    if (userRole === 'student') {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id, email')
        .eq('id', studentId)
        .single();

      if (!studentRecord || studentRecord.email?.toLowerCase() !== session.user.email.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    // -----------------------------------------------
    // 1. Student base info
    // -----------------------------------------------
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        photo_url,
        status,
        agency,
        cohort_id,
        created_at,
        cohort:cohorts(
          id,
          cohort_number,
          start_date,
          expected_end_date,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // -----------------------------------------------
    // 2. Station/skills progress (station_completions + station_pool)
    // -----------------------------------------------
    const [
      { data: allStations },
      { data: completions },
    ] = await Promise.all([
      supabase
        .from('station_pool')
        .select('id, station_code, station_name, category, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('station_completions')
        .select(`
          id,
          station_id,
          result,
          completed_at,
          notes,
          station:station_pool(station_name, category)
        `)
        .eq('student_id', studentId)
        .order('completed_at', { ascending: false }),
    ]);

    const stations = allStations || [];
    const stationCompletions = completions || [];

    // Build a map of station_id -> latest completion
    const latestByStation: Record<string, { result: string; completed_at: string }> = {};
    for (const c of stationCompletions) {
      if (!latestByStation[c.station_id]) {
        latestByStation[c.station_id] = { result: c.result, completed_at: c.completed_at };
      }
    }

    const totalStations = stations.length;
    const passedStations = stations.filter(s => latestByStation[s.id]?.result === 'pass').length;
    const passRate = totalStations > 0 ? Math.round((passedStations / totalStations) * 100) : 0;

    // Group by category
    const categoryMap: Record<string, { total: number; completed: number }> = {};
    for (const station of stations) {
      const cat = station.category || 'other';
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, completed: 0 };
      categoryMap[cat].total++;
      if (latestByStation[station.id]?.result === 'pass') {
        categoryMap[cat].completed++;
      }
    }
    const byCategory = Object.entries(categoryMap).map(([category, counts]) => ({
      category,
      total: counts.total,
      completed: counts.completed,
    }));

    const skills = {
      total: totalStations,
      completed: passedStations,
      passRate,
      byCategory,
      stationDetails: stations.map(s => ({
        id: s.id,
        station_code: s.station_code,
        station_name: s.station_name,
        category: s.category || 'other',
        result: latestByStation[s.id]?.result || 'not_started',
        completed_at: latestByStation[s.id]?.completed_at || null,
      })),
    };

    // -----------------------------------------------
    // 3. Scenario assessments (team lead scenarios)
    // -----------------------------------------------
    const { data: scenarioAssessments } = await supabase
      .from('scenario_assessments')
      .select(`
        id,
        overall_score,
        created_at,
        lab_day_id,
        lab_day:lab_days(date, week_number, day_number),
        station:lab_stations!lab_station_id(
          station_number,
          scenario:scenarios(title, category)
        ),
        grader:lab_users!graded_by(name)
      `)
      .eq('team_lead_id', studentId)
      .order('created_at', { ascending: false });

    // Scenario score -> letter grade
    const scoreToGrade = (score: number | null): string => {
      if (score === null || score === undefined) return 'N/A';
      if (score >= 4) return 'A';
      if (score >= 3) return 'B';
      if (score >= 2) return 'C';
      if (score >= 1) return 'D';
      return 'F';
    };

    const scenarioRows = (scenarioAssessments || []).map(a => {
      const stationData = a.station as any;
      const scenarioTitle = stationData?.scenario?.title || `Station ${stationData?.station_number || '?'}`;
      const graderData = a.grader as any;
      const labDayData = a.lab_day as any;
      return {
        id: a.id,
        scenario_name: scenarioTitle,
        date: labDayData?.date || a.created_at,
        grade: scoreToGrade(a.overall_score),
        score: a.overall_score,
        instructor: graderData?.name || 'Unknown',
      };
    });

    const scenarios = {
      total: scenarioRows.length,
      completed: scenarioRows.filter(s => s.grade !== 'N/A').length,
      grades: scenarioRows,
    };

    // -----------------------------------------------
    // 4. Clinical hours
    // -----------------------------------------------
    const { data: clinicalHoursData } = await supabase
      .from('student_clinical_hours')
      .select('department, hours, shifts')
      .eq('student_id', studentId);

    const REQUIRED_CLINICAL_HOURS = 24;
    const totalClinicalHours = (clinicalHoursData || []).reduce((sum, h) => sum + (h.hours || 0), 0);
    const byType = (clinicalHoursData || []).map(h => ({
      type: h.department || 'Unknown',
      hours: h.hours || 0,
    }));

    const clinicalHours = {
      total: totalClinicalHours,
      required: REQUIRED_CLINICAL_HOURS,
      byType,
    };

    // -----------------------------------------------
    // 5. Skill assessments (separate from scenario team lead)
    // -----------------------------------------------
    const { data: skillAssessments } = await supabase
      .from('skill_assessments')
      .select(`
        id,
        skill_name,
        overall_competency,
        assessed_at,
        grader:lab_users!graded_by(name)
      `)
      .eq('student_id', studentId)
      .order('assessed_at', { ascending: false });

    const skillAssessmentRows = (skillAssessments || []).map(a => {
      const graderData = a.grader as any;
      return {
        id: a.id,
        scenario_name: a.skill_name || 'Skill Assessment',
        date: a.assessed_at,
        grade: scoreToGrade(a.overall_competency ? (a.overall_competency - 1) : null), // scale 1-5 -> 0-4
        score: a.overall_competency,
        instructor: graderData?.name || 'Unknown',
      };
    });

    // -----------------------------------------------
    // 6. Milestones
    // -----------------------------------------------
    const milestones: Array<{
      name: string;
      status: 'completed' | 'in_progress' | 'not_started';
      date?: string;
      description?: string;
    }> = [];

    // First lab day milestone
    const { data: firstLabDay } = await supabase
      .from('lab_days')
      .select('date')
      .eq('cohort_id', student.cohort_id || '')
      .order('date', { ascending: true })
      .limit(1)
      .single();

    milestones.push({
      name: 'First Lab Day',
      status: firstLabDay ? 'completed' : 'not_started',
      date: firstLabDay?.date || undefined,
      description: 'Attended first lab session',
    });

    // Station milestones
    const stationMilestoneThresholds = [25, 50, 75, 100];
    for (const threshold of stationMilestoneThresholds) {
      const needed = Math.ceil((threshold / 100) * totalStations);
      const status: 'completed' | 'in_progress' | 'not_started' =
        passedStations >= needed ? 'completed' :
        passedStations > 0 ? 'in_progress' : 'not_started';

      // Find the date when the threshold was crossed
      let thresholdDate: string | undefined;
      if (status === 'completed' && stationCompletions.length > 0) {
        // Sort completions ascending by date and find when we hit needed passes
        const sortedCompletions = [...stationCompletions]
          .filter(c => c.result === 'pass')
          .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
        if (sortedCompletions[needed - 1]) {
          thresholdDate = sortedCompletions[needed - 1].completed_at;
        }
      }

      milestones.push({
        name: `${threshold}% Stations Completed`,
        status,
        date: thresholdDate,
        description: `Completed ${threshold}% of all required stations (${needed}/${totalStations})`,
      });
    }

    // First scenario passed
    const firstPassedScenario = scenarioRows.find(s => s.grade === 'A' || s.grade === 'B');
    milestones.push({
      name: 'First Scenario Passed',
      status: firstPassedScenario ? 'completed' : (scenarioRows.length > 0 ? 'in_progress' : 'not_started'),
      date: firstPassedScenario?.date || undefined,
      description: 'Passed first scenario as team lead',
    });

    // Clinical hours started
    milestones.push({
      name: 'Clinical Hours Started',
      status: totalClinicalHours > 0 ? 'completed' : 'not_started',
      description: 'Logged first clinical hours',
    });

    // All requirements met (simplified: stations 100% + clinical hours met)
    const allRequirementsMet = passRate === 100 && totalClinicalHours >= REQUIRED_CLINICAL_HOURS;
    milestones.push({
      name: 'All Requirements Met',
      status: allRequirementsMet ? 'completed' : (passRate > 0 || totalClinicalHours > 0 ? 'in_progress' : 'not_started'),
      description: 'Completed all station requirements and clinical hours',
    });

    // -----------------------------------------------
    // 7. Lab day attendance
    // -----------------------------------------------
    const { data: attendanceData } = await supabase
      .from('lab_day_attendance')
      .select('status')
      .eq('student_id', studentId);

    const attendanceRecords = attendanceData || [];
    const attendanceTotal = attendanceRecords.length;
    const attendancePresent = attendanceRecords.filter(a => a.status === 'present').length;
    const attendanceAbsent = attendanceRecords.filter(a => a.status === 'absent').length;
    const attendanceExcused = attendanceRecords.filter(a => a.status === 'excused').length;
    const attendanceLate = attendanceRecords.filter(a => a.status === 'late').length;
    const attendanceRate = attendanceTotal > 0
      ? Math.round(((attendancePresent + attendanceLate) / attendanceTotal) * 100)
      : 0;

    const attendance = {
      total: attendanceTotal,
      present: attendancePresent,
      absent: attendanceAbsent,
      excused: attendanceExcused,
      late: attendanceLate,
      rate: attendanceRate,
    };

    // -----------------------------------------------
    // 8. Recent activity (last 30 days)
    // -----------------------------------------------
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    const recentActivity: Array<{
      type: string;
      description: string;
      date: string;
      icon?: string;
    }> = [];

    // Recent station completions
    const recentCompletions = stationCompletions.filter(c => c.completed_at >= cutoff);
    for (const c of recentCompletions.slice(0, 10)) {
      const stationData = c.station as any;
      recentActivity.push({
        type: 'station_completion',
        description: `Station completed: ${stationData?.station_name || 'Unknown'} — ${c.result.replace('_', ' ')}`,
        date: c.completed_at,
        icon: c.result === 'pass' ? 'CheckCircle' : 'AlertCircle',
      });
    }

    // Recent scenario assessments
    for (const s of scenarioRows.filter(r => r.date >= cutoff).slice(0, 5)) {
      recentActivity.push({
        type: 'scenario_graded',
        description: `Scenario graded: ${s.scenario_name} — Grade ${s.grade}`,
        date: s.date,
        icon: 'ClipboardCheck',
      });
    }

    // Recent skill assessments
    for (const s of skillAssessmentRows.filter(r => r.date >= cutoff).slice(0, 5)) {
      recentActivity.push({
        type: 'skill_assessed',
        description: `Skill assessed: ${s.scenario_name} — Score ${s.score}/5`,
        date: s.date,
        icon: 'BookOpen',
      });
    }

    // Sort all activity by date desc and take top 20
    recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const topActivity = recentActivity.slice(0, 20);

    // -----------------------------------------------
    // Build response
    // -----------------------------------------------
    const cohortData = student.cohort as any;
    const programData = cohortData?.program;

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        photo_url: student.photo_url,
        status: student.status,
        cohort: cohortData ? {
          id: cohortData.id,
          cohort_number: cohortData.cohort_number,
          start_date: cohortData.start_date,
          expected_end_date: cohortData.expected_end_date,
          name: programData ? `${programData.abbreviation} Group ${cohortData.cohort_number}` : `Group ${cohortData.cohort_number}`,
        } : null,
      },
      skills,
      scenarios: {
        ...scenarios,
        grades: [...scenarioRows, ...skillAssessmentRows]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      },
      clinicalHours,
      attendance,
      milestones,
      recentActivity: topActivity,
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return NextResponse.json({ error: 'Failed to fetch student progress' }, { status: 500 });
  }
}
