import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
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

    // Fetch scenario assessments for the cohort in date range
    let scenarioScores = {
      averageAssessment: 0,
      averageTreatment: 0,
      averageCommunication: 0,
      averageOverall: 0,
    };

    if (includeScenarios && labDays && labDays.length > 0) {
      const labDayIds = labDays.map((d: any) => d.id);
      const { data: scenarioAssessments } = await supabase
        .from('scenario_assessments')
        .select('*')
        .eq('cohort_id', cohortId)
        .in('lab_day_id', labDayIds);

      if (scenarioAssessments && scenarioAssessments.length > 0) {
        // Parse criteria ratings to calculate averages
        let assessmentTotal = 0, treatmentTotal = 0, communicationTotal = 0, overallTotal = 0;
        let count = 0;

        scenarioAssessments.forEach((assessment: any) => {
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
          count++;
        });

        if (count > 0) {
          // Convert to percentage (assuming max of count for each category)
          scenarioScores = {
            averageAssessment: count > 0 ? (assessmentTotal / count) * 100 : 0,
            averageTreatment: count > 0 ? (treatmentTotal / count) * 100 : 0,
            averageCommunication: count > 0 ? (communicationTotal / count) * 100 : 0,
            averageOverall: count > 0 ? (overallTotal / count) : 0,
          };
        }
      }
    }

    // Fetch skill assessments
    let skillsProgress = {
      completed: 0,
      total: 0,
      completionRate: 0,
    };

    if (includeSkills && studentIds.length > 0) {
      const { data: skillAssessments } = await supabase
        .from('skill_assessments')
        .select('student_id, skill_name, passed')
        .in('student_id', studentIds);

      if (skillAssessments) {
        const passedSkills = skillAssessments.filter((a: any) => a.passed);
        skillsProgress = {
          completed: passedSkills.length,
          total: skillAssessments.length,
          completionRate: skillAssessments.length > 0
            ? (passedSkills.length / skillAssessments.length) * 100
            : 0,
        };
      }
    }

    // Fetch team lead rotations
    let teamLeadStats = {
      totalRotations: 0,
      averagePerStudent: 0,
      studentsWithZero: 0,
    };

    if (studentIds.length > 0) {
      let tlQuery = supabase
        .from('team_lead_log')
        .select('student_id, date')
        .in('student_id', studentIds);

      if (startDate) {
        tlQuery = tlQuery.gte('date', startDate);
      }
      if (endDate) {
        tlQuery = tlQuery.lte('date', endDate);
      }

      const { data: tlLogs } = await tlQuery;

      const tlCountMap: Record<string, number> = {};
      studentIds.forEach(id => {
        tlCountMap[id] = 0;
      });

      if (tlLogs) {
        tlLogs.forEach((log: any) => {
          tlCountMap[log.student_id] = (tlCountMap[log.student_id] || 0) + 1;
        });
      }

      const tlCounts = Object.values(tlCountMap);
      teamLeadStats = {
        totalRotations: tlCounts.reduce((sum, c) => sum + c, 0),
        averagePerStudent: studentIds.length > 0
          ? tlCounts.reduce((sum, c) => sum + c, 0) / studentIds.length
          : 0,
        studentsWithZero: tlCounts.filter(c => c === 0).length,
      };
    }

    // Build student breakdown with per-student stats
    const studentBreakdown: any[] = [];
    const flaggedStudents: any[] = [];

    for (const student of students || []) {
      let scenarioCount = 0;
      let averageScore = 0;
      let skillsCompleted = 0;
      let teamLeadCount = 0;
      let attendance = 100; // Default to 100% if we don't track attendance

      // Get scenario assessments for this student (through team lead)
      if (includeScenarios && labDays && labDays.length > 0) {
        const labDayIds = labDays.map((d: any) => d.id);
        const { data: studentScenarios } = await supabase
          .from('scenario_assessments')
          .select('overall_score')
          .eq('team_lead_id', student.id)
          .in('lab_day_id', labDayIds);

        if (studentScenarios && studentScenarios.length > 0) {
          scenarioCount = studentScenarios.length;
          const totalScore = studentScenarios.reduce((sum: number, s: any) => sum + (s.overall_score || 0), 0);
          averageScore = totalScore / scenarioCount;
        }
      }

      // Get skill assessments for this student
      if (includeSkills) {
        const { data: studentSkills } = await supabase
          .from('skill_assessments')
          .select('passed')
          .eq('student_id', student.id);

        if (studentSkills) {
          skillsCompleted = studentSkills.filter((s: any) => s.passed).length;
        }
      }

      // Get team lead count
      let tlQuery = supabase
        .from('team_lead_log')
        .select('id')
        .eq('student_id', student.id);

      if (startDate) {
        tlQuery = tlQuery.gte('date', startDate);
      }
      if (endDate) {
        tlQuery = tlQuery.lte('date', endDate);
      }

      const { data: studentTL } = await tlQuery;
      teamLeadCount = studentTL?.length || 0;

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
