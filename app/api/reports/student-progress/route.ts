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
    const studentId = searchParams.get('studentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId is required' }, { status: 400 });
    }

    // Fetch student info with cohort
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        status,
        cohort:cohorts(
          id,
          cohort_number,
          program:programs(name, abbreviation)
        )
      `)
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    const cohortId = (student.cohort as any)?.id;

    // Fetch lab days in date range for this cohort
    let labDaysQuery = supabase
      .from('lab_days')
      .select('id, date')
      .eq('cohort_id', cohortId)
      .order('date');

    if (startDate) {
      labDaysQuery = labDaysQuery.gte('date', startDate);
    }
    if (endDate) {
      labDaysQuery = labDaysQuery.lte('date', endDate);
    }

    const { data: labDays } = await labDaysQuery;
    const labDayIds = labDays?.map(d => d.id) || [];

    // Fetch scenario assessments where this student was team lead
    let scenarioQuery = supabase
      .from('scenario_assessments')
      .select(`
        id,
        overall_score,
        criteria_ratings,
        created_at,
        lab_day:lab_days(date),
        station:lab_stations(
          scenario:scenarios(title, category)
        )
      `)
      .eq('team_lead_id', studentId)
      .order('created_at', { ascending: false });

    if (labDayIds.length > 0) {
      scenarioQuery = scenarioQuery.in('lab_day_id', labDayIds);
    }

    const { data: scenarioAssessments } = await scenarioQuery;

    // Calculate scenario performance
    let totalScore = 0;
    let scenarioCount = scenarioAssessments?.length || 0;
    const recentScenarios: any[] = [];

    scenarioAssessments?.forEach((assessment: any, index: number) => {
      const score = assessment.overall_score || 0;
      totalScore += score;

      if (index < 10) { // Recent 10 scenarios
        recentScenarios.push({
          date: assessment.lab_day?.date || assessment.created_at,
          scenarioTitle: assessment.station?.scenario?.title || 'Unknown Scenario',
          score: score,
          wasTeamLead: true,
        });
      }
    });

    const averageScore = scenarioCount > 0 ? totalScore / scenarioCount : 0;

    // Calculate trend (compare first half to second half of scenarios)
    let recentTrend: 'up' | 'down' | 'stable' = 'stable';
    if (scenarioAssessments && scenarioAssessments.length >= 4) {
      const half = Math.floor(scenarioAssessments.length / 2);
      const olderHalf = scenarioAssessments.slice(half);
      const newerHalf = scenarioAssessments.slice(0, half);

      const olderAvg = olderHalf.reduce((sum: number, a: any) => sum + (a.overall_score || 0), 0) / olderHalf.length;
      const newerAvg = newerHalf.reduce((sum: number, a: any) => sum + (a.overall_score || 0), 0) / newerHalf.length;

      if (newerAvg > olderAvg + 5) {
        recentTrend = 'up';
      } else if (newerAvg < olderAvg - 5) {
        recentTrend = 'down';
      }
    }

    // Fetch skill assessments for this student
    const { data: skillAssessments } = await supabase
      .from('skill_assessments')
      .select('id, student_id, skill_name, passed, assessed_at')
      .eq('student_id', studentId)
      .order('assessed_at', { ascending: false });

    // Aggregate skills
    const skillsMap: Record<string, { name: string; attempts: number; passed: boolean; lastAttemptDate: string }> = {};

    skillAssessments?.forEach((assessment: any) => {
      const skillName = assessment.skill_name;
      if (!skillsMap[skillName]) {
        skillsMap[skillName] = {
          name: skillName,
          attempts: 0,
          passed: false,
          lastAttemptDate: assessment.assessed_at,
        };
      }
      skillsMap[skillName].attempts++;
      if (assessment.passed) {
        skillsMap[skillName].passed = true;
      }
    });

    const skillsList = Object.values(skillsMap);
    const passedSkills = skillsList.filter(s => s.passed).length;
    const attemptedSkills = skillsList.length;

    // Fetch team lead rotations
    let tlQuery = supabase
      .from('team_lead_log')
      .select(`
        id,
        date,
        scenario:scenarios(title)
      `)
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (startDate) {
      tlQuery = tlQuery.gte('date', startDate);
    }
    if (endDate) {
      tlQuery = tlQuery.lte('date', endDate);
    }

    const { data: tlLogs } = await tlQuery;

    // Get cohort average for team lead rotations
    const { data: cohortStudents } = await supabase
      .from('students')
      .select('id')
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    let cohortTlAverage = 0;
    if (cohortStudents && cohortStudents.length > 0) {
      const studentIds = cohortStudents.map(s => s.id);
      let cohortTlQuery = supabase
        .from('team_lead_log')
        .select('id', { count: 'exact', head: true })
        .in('student_id', studentIds);

      if (startDate) {
        cohortTlQuery = cohortTlQuery.gte('date', startDate);
      }
      if (endDate) {
        cohortTlQuery = cohortTlQuery.lte('date', endDate);
      }

      const { count: tlCount } = await cohortTlQuery;
      cohortTlAverage = tlCount ? tlCount / cohortStudents.length : 0;
    }

    // Calculate attendance (placeholder - would need attendance tracking table)
    const totalLabs = labDays?.length || 0;
    const labsAttended = totalLabs; // Default to 100% if not tracking
    const attendanceRate = totalLabs > 0 ? (labsAttended / totalLabs) * 100 : 100;

    // Build flagged items
    const flaggedItems: any[] = [];

    if (averageScore > 0 && averageScore < 70) {
      flaggedItems.push({
        type: 'Low Scenario Scores',
        message: `Average scenario score is ${averageScore.toFixed(1)}%, below the 70% threshold`,
      });
    }

    if (tlLogs && tlLogs.length === 0 && totalLabs > 2) {
      flaggedItems.push({
        type: 'No Team Lead Experience',
        message: `Student has not served as team lead in ${totalLabs} lab days`,
      });
    }

    if (passedSkills < attemptedSkills * 0.5 && attemptedSkills > 0) {
      flaggedItems.push({
        type: 'Low Skill Pass Rate',
        message: `Only ${passedSkills} of ${attemptedSkills} attempted skills passed`,
      });
    }

    const report = {
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        cohort: `${(student.cohort as any)?.program?.abbreviation || 'Unknown'} Group ${(student.cohort as any)?.cohort_number}`,
        status: student.status,
      },
      dateRange: {
        start: startDate || 'All time',
        end: endDate || 'Present',
      },
      scenarioPerformance: {
        totalScenarios: scenarioCount,
        averageScore,
        recentTrend,
        byCategory: [], // Would need to aggregate by category
        recentScenarios,
      },
      skillsProgress: {
        passed: passedSkills,
        attempted: attemptedSkills,
        total: attemptedSkills, // Would need skills requirements table
        passRate: attemptedSkills > 0 ? (passedSkills / attemptedSkills) * 100 : 0,
        skills: skillsList,
      },
      teamLeadHistory: {
        totalRotations: tlLogs?.length || 0,
        cohortAverage: cohortTlAverage,
        rotations: (tlLogs || []).map((tl: any) => ({
          date: tl.date,
          scenario: tl.scenario?.title || 'Scenario',
        })),
      },
      attendance: {
        labsAttended,
        totalLabs,
        rate: attendanceRate,
      },
      flaggedItems,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error generating student progress report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
