import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // 1. Student count by program
    const { data: students } = await supabase
      .from('students')
      .select('id, status, cohort:cohorts!students_cohort_id_fkey(id, cohort_number, program:programs(id, name, abbreviation))')
      .eq('status', 'active');

    const studentsByProgram: Record<string, number> = {};
    let totalStudents = 0;
    (students || []).forEach((s: any) => {
      const progName = s.cohort?.program?.abbreviation || s.cohort?.program?.name || 'Unknown';
      studentsByProgram[progName] = (studentsByProgram[progName] || 0) + 1;
      totalStudents++;
    });

    const studentsByProgramArray = Object.entries(studentsByProgram).map(([name, count]) => ({
      name,
      count,
    }));

    // 2. Lab days count (with optional date filter)
    let labDaysQuery = supabase.from('lab_days').select('id, date, cohort_id', { count: 'exact' });
    if (startDate) labDaysQuery = labDaysQuery.gte('date', startDate);
    if (endDate) labDaysQuery = labDaysQuery.lte('date', endDate);
    const { count: labDaysCount } = await labDaysQuery;

    // 3. Average stations per lab
    let stationsQuery = supabase
      .from('lab_stations')
      .select('id, lab_day_id, lab_day:lab_days(date)');

    const { data: allStations } = await stationsQuery;

    // Filter by date range if needed
    let filteredStations = allStations || [];
    if (startDate || endDate) {
      filteredStations = filteredStations.filter((s: any) => {
        const labDay = Array.isArray(s.lab_day) ? s.lab_day[0] : s.lab_day;
        const date = labDay?.date;
        if (!date) return false;
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    }

    const stationsByLabDay: Record<string, number> = {};
    filteredStations.forEach((s: any) => {
      stationsByLabDay[s.lab_day_id] = (stationsByLabDay[s.lab_day_id] || 0) + 1;
    });
    const labDayIds = Object.keys(stationsByLabDay);
    const avgStationsPerLab =
      labDayIds.length > 0
        ? Math.round(
            (Object.values(stationsByLabDay).reduce((a, b) => a + b, 0) / labDayIds.length) * 10
          ) / 10
        : 0;

    // 4. Top scenarios by usage (from lab_stations with scenario_id)
    const { data: stationsWithScenarios } = await supabase
      .from('lab_stations')
      .select('id, scenario_id, scenario:scenarios(id, title)')
      .not('scenario_id', 'is', null);

    const scenarioUsage: Record<string, { title: string; count: number }> = {};
    (stationsWithScenarios || []).forEach((s: any) => {
      const scenario = Array.isArray(s.scenario) ? s.scenario[0] : s.scenario;
      if (!scenario) return;
      if (!scenarioUsage[scenario.id]) {
        scenarioUsage[scenario.id] = { title: scenario.title, count: 0 };
      }
      scenarioUsage[scenario.id].count++;
    });

    const topScenarios = Object.entries(scenarioUsage)
      .map(([id, { title, count }]) => ({ id, name: title, usage: count }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    // 5. Skill pass rates (from skill_signoffs and skills)
    const { data: skills } = await supabase.from('skills').select('id, name', { count: 'exact' });
    const totalSkills = skills?.length || 0;

    const { data: signoffs } = await supabase
      .from('skill_signoffs')
      .select('id, student_id, skill_id')
      .is('revoked_at', null);

    const totalSignoffs = signoffs?.length || 0;
    const uniqueStudentsWithSignoffs = new Set((signoffs || []).map((s: any) => s.student_id)).size;

    // Overall pass rate = unique signoffs / (total students * total skills) if we have data
    const skillPassRate =
      totalStudents > 0 && totalSkills > 0
        ? Math.round((totalSignoffs / (totalStudents * totalSkills)) * 100)
        : 0;

    // 6. Recent lab days
    let recentLabsQuery = supabase
      .from('lab_days')
      .select('id, date, title, cohort:cohorts(cohort_number, program:programs(abbreviation))')
      .order('date', { ascending: false })
      .limit(10);

    if (startDate) recentLabsQuery = recentLabsQuery.gte('date', startDate);
    if (endDate) recentLabsQuery = recentLabsQuery.lte('date', endDate);

    const { data: recentLabs } = await recentLabsQuery;

    const response = NextResponse.json({
      success: true,
      student_count: totalStudents,
      students_by_program: studentsByProgramArray,
      lab_days_count: labDaysCount || 0,
      avg_stations_per_lab: avgStationsPerLab,
      top_scenarios: topScenarios,
      skill_pass_rate: skillPassRate,
      total_skills: totalSkills,
      total_signoffs: totalSignoffs,
      students_with_signoffs: uniqueStudentsWithSignoffs,
      recent_labs: (recentLabs || []).map((lab: any) => ({
        id: lab.id,
        date: lab.date,
        title: lab.title,
        cohort: lab.cohort
          ? `${(lab.cohort as any).program?.abbreviation || 'PMD'} C${(lab.cohort as any).cohort_number}`
          : null,
      })),
    });

    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error generating program overview report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
