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
      { data: cohortStudents },
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
      // Fetch all students in the same cohort for cohort average
      student.cohort_id
        ? supabase
            .from('students')
            .select('id')
            .eq('cohort_id', student.cohort_id)
            .eq('status', 'active')
        : Promise.resolve({ data: [] as Array<{ id: string }> | null }),
    ]);

    const stations = allStations || [];
    const stationCompletions = completions || [];
    const cohortStudentIds = (cohortStudents || []).map((s: { id: string }) => s.id);

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
    // 2b. Skill progression timeline
    // -----------------------------------------------
    // Helper: get ISO week label "YYYY-Www" from a date string
    function getWeekLabel(dateStr: string): string {
      const d = new Date(dateStr);
      const thursday = new Date(d);
      thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
      const year = thursday.getFullYear();
      const jan4 = new Date(year, 0, 4);
      const week = Math.round(((thursday.getTime() - jan4.getTime()) / 86400000 + ((jan4.getDay() + 6) % 7) + 1) / 7);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }

    // Build student's weekly cumulative pass counts
    // Only count passes (using earliest pass per station to avoid re-count)
    const studentPassDates: string[] = [];
    const studentPassedStationIds = new Set<string>();
    const sortedStudentCompletions = [...stationCompletions]
      .filter(c => c.result === 'pass')
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());

    for (const c of sortedStudentCompletions) {
      if (!studentPassedStationIds.has(c.station_id)) {
        studentPassedStationIds.add(c.station_id);
        studentPassDates.push(c.completed_at);
      }
    }

    // Group student passes by week
    const studentByWeek: Record<string, number> = {};
    for (const date of studentPassDates) {
      const wk = getWeekLabel(date);
      studentByWeek[wk] = (studentByWeek[wk] || 0) + 1;
    }

    // Fetch cohort completions if student is in a cohort with multiple students
    let cohortTimeline: Array<{ date: string; studentCount: number; cohortAvg: number }> = [];
    const otherCohortStudentIds = cohortStudentIds.filter((id: string) => id !== studentId);

    let cohortByWeek: Record<string, number[]> = {};

    if (otherCohortStudentIds.length > 0) {
      const { data: cohortCompletions } = await supabase
        .from('station_completions')
        .select('student_id, station_id, result, completed_at')
        .in('student_id', cohortStudentIds) // include self for true avg
        .eq('result', 'pass')
        .order('completed_at', { ascending: true });

      // For each cohort student, track first pass per station
      const cohortPassedByStudent: Record<string, Set<string>> = {};
      const cohortPassDatesByStudent: Record<string, string[]> = {};

      for (const c of cohortCompletions || []) {
        if (!cohortPassedByStudent[c.student_id]) {
          cohortPassedByStudent[c.student_id] = new Set();
          cohortPassDatesByStudent[c.student_id] = [];
        }
        if (!cohortPassedByStudent[c.student_id].has(c.station_id)) {
          cohortPassedByStudent[c.student_id].add(c.station_id);
          cohortPassDatesByStudent[c.student_id].push(c.completed_at);
        }
      }

      // Build a week -> [per-student cumulative count at that week] mapping
      // Collect all weeks that appear
      const allWeeks = new Set<string>();
      for (const studentDates of Object.values(cohortPassDatesByStudent)) {
        for (const d of studentDates) {
          allWeeks.add(getWeekLabel(d));
        }
      }
      // Also include student's own weeks
      for (const wk of Object.keys(studentByWeek)) {
        allWeeks.add(wk);
      }

      const sortedWeeks = Array.from(allWeeks).sort();

      // For cohort average: for each week, compute cumulative count per student then average
      const cohortStudentCount = cohortStudentIds.length || 1;

      cohortTimeline = sortedWeeks.map(wk => {
        // Student cumulative up to this week
        let studentCumulative = 0;
        for (const [w, cnt] of Object.entries(studentByWeek)) {
          if (w <= wk) studentCumulative += cnt;
        }

        // Cohort total passes up to this week (sum across all students)
        let cohortTotal = 0;
        for (const [sid, dates] of Object.entries(cohortPassDatesByStudent)) {
          void sid;
          for (const d of dates) {
            if (getWeekLabel(d) <= wk) cohortTotal++;
          }
        }
        const cohortAvg = Math.round((cohortTotal / cohortStudentCount) * 10) / 10;

        // Format week label for display: "Jan 5"
        const [year, weekNum] = wk.split('-W').map(Number);
        const jan1 = new Date(year, 0, 1);
        const weekStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 86400000);
        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return {
          date: label,
          studentCount: studentCumulative,
          cohortAvg,
        };
      });
    } else {
      // No cohort data - just build student timeline
      const sortedWeeks = Array.from(new Set(studentPassDates.map(d => getWeekLabel(d)))).sort();
      let cumulative = 0;
      cohortTimeline = sortedWeeks.map(wk => {
        cumulative += studentByWeek[wk] || 0;
        const [year, weekNum] = wk.split('-W').map(Number);
        const jan1 = new Date(year, 0, 1);
        const weekStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 86400000);
        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { date: label, studentCount: cumulative, cohortAvg: cumulative };
      });
    }

    // Projected completion date based on current rate
    let projectedCompletion: string | null = null;
    if (passedStations > 0 && passedStations < totalStations && studentPassDates.length >= 2) {
      const firstPassDate = new Date(studentPassDates[0]);
      const lastPassDate = new Date(studentPassDates[studentPassDates.length - 1]);
      const elapsedDays = Math.max(1, (lastPassDate.getTime() - firstPassDate.getTime()) / 86400000);
      const ratePerDay = passedStations / elapsedDays;
      const remaining = totalStations - passedStations;
      const daysToComplete = remaining / ratePerDay;
      const projectedDate = new Date(lastPassDate.getTime() + daysToComplete * 86400000);
      projectedCompletion = projectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (passedStations >= totalStations && totalStations > 0) {
      projectedCompletion = 'Completed';
    }

    const timeline = {
      data: cohortTimeline,
      projectedCompletion,
      totalStations,
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
      timeline,
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return NextResponse.json({ error: 'Failed to fetch student progress' }, { status: 500 });
  }
}
