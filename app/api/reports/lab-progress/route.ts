import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeScenarios = searchParams.get('includeScenarios') !== 'false';
    const includeSkills = searchParams.get('includeSkills') !== 'false';
    const includeAttendance = searchParams.get('includeAttendance') !== 'false';

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
    }

    // Fetch cohort info
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        program:programs(name, abbreviation)
      `)
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }

    // Fetch students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, status')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name');

    if (studentsError) throw studentsError;

    const studentIds = students?.map(s => s.id) || [];

    // Fetch lab days in date range
    let labDaysQuery = supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        stations:lab_stations(id, station_type, scenario_id)
      `)
      .eq('cohort_id', cohortId)
      .order('date');

    if (startDate) {
      labDaysQuery = labDaysQuery.gte('date', startDate);
    }
    if (endDate) {
      labDaysQuery = labDaysQuery.lte('date', endDate);
    }

    const { data: labDays, error: labDaysError } = await labDaysQuery;
    if (labDaysError) throw labDaysError;

    // Calculate summary stats
    const totalLabDays = labDays?.length || 0;
    let totalStations = 0;
    let scenarioStations = 0;
    let skillStations = 0;

    labDays?.forEach((day: any) => {
      const stationCount = day.stations?.length || 0;
      totalStations += stationCount;
      day.stations?.forEach((station: any) => {
        if (station.station_type === 'scenario') {
          scenarioStations++;
        } else if (station.station_type === 'skill') {
          skillStations++;
        }
      });
    });

    // Build student breakdown with per-student stats
    // BATCH QUERIES: Fetch all data once, then process in memory for both cohort stats and per-student breakdown
    const studentBreakdown: any[] = [];
    const flaggedStudents: any[] = [];

    // Batch fetch all scenario assessments for all students (includes criteria_ratings for cohort averages)
    let allScenarioAssessments: any[] = [];
    if (includeScenarios && labDays && labDays.length > 0 && studentIds.length > 0) {
      const labDayIds = labDays.map((d: any) => d.id);
      const { data } = await supabase
        .from('scenario_assessments')
        .select('team_lead_id, overall_score, criteria_ratings, cohort_id, lab_day_id')
        .in('team_lead_id', studentIds)
        .in('lab_day_id', labDayIds);

      allScenarioAssessments = data || [];
    }

    // Batch fetch all skill assessments for all students
    let allSkillAssessments: any[] = [];
    if (includeSkills && studentIds.length > 0) {
      const { data } = await supabase
        .from('skill_assessments')
        .select('student_id, passed')
        .in('student_id', studentIds);

      allSkillAssessments = data || [];
    }

    // Batch fetch all team lead logs for all students
    let allTeamLeadLogs: any[] = [];
    if (studentIds.length > 0) {
      let tlQuery = supabase
        .from('team_lead_log')
        .select('student_id, id')
        .in('student_id', studentIds);

      if (startDate) {
        tlQuery = tlQuery.gte('date', startDate);
      }
      if (endDate) {
        tlQuery = tlQuery.lte('date', endDate);
      }

      const { data } = await tlQuery;
      allTeamLeadLogs = data || [];
    }

    // Group data by student_id in memory using Maps
    const scenariosByStudent = new Map<string, any[]>();
    allScenarioAssessments.forEach((assessment) => {
      const studentId = assessment.team_lead_id;
      if (!scenariosByStudent.has(studentId)) {
        scenariosByStudent.set(studentId, []);
      }
      scenariosByStudent.get(studentId)!.push(assessment);
    });

    const skillsByStudent = new Map<string, any[]>();
    allSkillAssessments.forEach((skill) => {
      const studentId = skill.student_id;
      if (!skillsByStudent.has(studentId)) {
        skillsByStudent.set(studentId, []);
      }
      skillsByStudent.get(studentId)!.push(skill);
    });

    const teamLeadByStudent = new Map<string, any[]>();
    allTeamLeadLogs.forEach((log) => {
      const studentId = log.student_id;
      if (!teamLeadByStudent.has(studentId)) {
        teamLeadByStudent.set(studentId, []);
      }
      teamLeadByStudent.get(studentId)!.push(log);
    });

    // Compute cohort-level scenario scores from batched data
    let scenarioScores = {
      averageAssessment: 0,
      averageTreatment: 0,
      averageCommunication: 0,
      averageOverall: 0,
    };

    if (allScenarioAssessments.length > 0) {
      let assessmentTotal = 0, treatmentTotal = 0, communicationTotal = 0, overallTotal = 0;
      const count = allScenarioAssessments.length;

      allScenarioAssessments.forEach((assessment: any) => {
        const ratings = assessment.criteria_ratings || [];
        ratings.forEach((rating: any) => {
          const category = rating.category?.toLowerCase() || '';
          const score = rating.satisfactory ? 1 : 0;

          if (category.includes('assessment') || category.includes('patient')) {
            assessmentTotal += score;
          } else if (category.includes('treatment') || category.includes('intervention')) {
            treatmentTotal += score;
          } else if (category.includes('communication') || category.includes('team')) {
            communicationTotal += score;
          }
        });

        overallTotal += assessment.overall_score || 0;
      });

      scenarioScores = {
        averageAssessment: (assessmentTotal / count) * 100,
        averageTreatment: (treatmentTotal / count) * 100,
        averageCommunication: (communicationTotal / count) * 100,
        averageOverall: overallTotal / count,
      };
    }

    // Compute cohort-level skills progress from batched data
    let skillsProgress = {
      completed: 0,
      total: 0,
      completionRate: 0,
    };

    if (allSkillAssessments.length > 0) {
      const passedCount = allSkillAssessments.filter((a: any) => a.passed).length;
      skillsProgress = {
        completed: passedCount,
        total: allSkillAssessments.length,
        completionRate: (passedCount / allSkillAssessments.length) * 100,
      };
    }

    // Compute cohort-level team lead stats from batched data
    const tlCountMap: Record<string, number> = {};
    studentIds.forEach(id => {
      tlCountMap[id] = 0;
    });
    allTeamLeadLogs.forEach((log: any) => {
      tlCountMap[log.student_id] = (tlCountMap[log.student_id] || 0) + 1;
    });
    const tlCounts = Object.values(tlCountMap);
    const tlTotal = tlCounts.reduce((sum, c) => sum + c, 0);
    const teamLeadStats = {
      totalRotations: tlTotal,
      averagePerStudent: studentIds.length > 0 ? tlTotal / studentIds.length : 0,
      studentsWithZero: tlCounts.filter(c => c === 0).length,
    };

    // Process each student using the batched data
    for (const student of students || []) {
      let scenarioCount = 0;
      let averageScore = 0;
      let skillsCompleted = 0;
      let teamLeadCount = 0;
      let attendance = 100; // Default to 100% if we don't track attendance

      // Get scenario assessments from batched data
      const studentScenarios = scenariosByStudent.get(student.id) || [];
      if (studentScenarios.length > 0) {
        scenarioCount = studentScenarios.length;
        const totalScore = studentScenarios.reduce((sum: number, s: any) => sum + (s.overall_score || 0), 0);
        averageScore = totalScore / scenarioCount;
      }

      // Get skill assessments from batched data
      const studentSkills = skillsByStudent.get(student.id) || [];
      skillsCompleted = studentSkills.filter((s: any) => s.passed).length;

      // Get team lead count from batched data
      const studentTL = teamLeadByStudent.get(student.id) || [];
      teamLeadCount = studentTL.length;

      // Add to breakdown
      const studentData = {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        scenarioCount,
        averageScore,
        skillsCompleted,
        teamLeadCount,
        attendance,
      };

      studentBreakdown.push(studentData);

      // Flag students for review based on criteria
      if (includeScenarios && averageScore > 0 && averageScore < 70) {
        flaggedStudents.push({
          id: student.id,
          name: studentData.name,
          reason: 'Low scenario scores',
          details: `Average: ${averageScore.toFixed(1)}%`,
        });
      }

      if (teamLeadCount === 0 && totalLabDays > 2) {
        flaggedStudents.push({
          id: student.id,
          name: studentData.name,
          reason: 'No team lead rotations',
          details: `0 rotations in ${totalLabDays} lab days`,
        });
      }

      if (includeAttendance && attendance < 80) {
        flaggedStudents.push({
          id: student.id,
          name: studentData.name,
          reason: 'Low attendance',
          details: `${attendance}% attendance`,
        });
      }
    }

    // Sort student breakdown by name
    studentBreakdown.sort((a, b) => a.name.localeCompare(b.name));

    const report = {
      cohort: {
        id: cohort.id,
        name: `${(cohort.program as any)?.abbreviation || 'Unknown'} Group ${cohort.cohort_number}`,
        programAbbreviation: (cohort.program as any)?.abbreviation || 'Unknown',
        cohortNumber: cohort.cohort_number,
      },
      dateRange: {
        start: startDate || 'All time',
        end: endDate || 'Present',
      },
      summary: {
        totalLabDays,
        totalStations,
        scenarioStations,
        skillStations,
        totalStudents: students?.length || 0,
      },
      scenarioScores,
      skillsProgress,
      teamLeadStats,
      flaggedStudents,
      studentBreakdown,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error generating lab progress report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
