import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Require lead_instructor minimum role
    const { data: requestingUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!requestingUser || !hasMinRole(requestingUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    // Fetch all active scenarios
    let scenariosQuery = supabase
      .from('scenarios')
      .select('id, title, category, difficulty, is_active')
      .order('title');

    if (category) {
      scenariosQuery = scenariosQuery.eq('category', category);
    }

    const { data: scenarios, error: scenariosError } = await scenariosQuery;
    if (scenariosError) throw scenariosError;

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({
        success: true,
        scenarios: [],
        categories: [],
        summary: {
          totalAssessed: 0,
          avgPassRate: null,
          hardestScenario: null,
          easiestScenario: null,
        },
      });
    }

    // Fetch lab_stations that have a scenario_id so we can link assessments -> scenario
    // scenario_assessments links to lab_stations which links to scenarios
    const { data: stationsWithScenario, error: stationsError } = await supabase
      .from('lab_stations')
      .select('id, scenario_id, lab_day_id, lab_day:lab_days(id, date)')
      .not('scenario_id', 'is', null);

    if (stationsError) throw stationsError;

    // Build: lab_station_id -> { scenario_id, lab_date }
    const stationMap: Record<string, { scenarioId: string; labDate: string | null }> = {};
    (stationsWithScenario || []).forEach((station: any) => {
      if (!station.scenario_id) return;
      const labDay = Array.isArray(station.lab_day) ? station.lab_day[0] : station.lab_day;
      stationMap[station.id] = {
        scenarioId: station.scenario_id,
        labDate: labDay?.date ?? null,
      };
    });

    // Fetch all scenario assessments
    const { data: assessments, error: assessmentsError } = await supabase
      .from('scenario_assessments')
      .select('id, lab_station_id, overall_score, issue_level, flagged_for_review, created_at');

    if (assessmentsError) throw assessmentsError;

    // Aggregate per scenario
    // Pass threshold: overall_score >= 3 (B or above on 0-5 scale)
    // Also treat issue_level = 'none' as passing indicator when score is unavailable
    const PASS_THRESHOLD = 3;

    // scenario_id -> { count, totalScore, scoreCount, passCount }
    const aggMap: Record<
      string,
      { count: number; totalScore: number; scoreCount: number; passCount: number }
    > = {};

    (assessments || []).forEach((a: any) => {
      const stationInfo = stationMap[a.lab_station_id];
      if (!stationInfo) return;

      const { scenarioId, labDate } = stationInfo;

      // Apply date range filter via lab_day date
      if (startDate && labDate && labDate < startDate) return;
      if (endDate && labDate && labDate > endDate) return;
      if ((startDate || endDate) && !labDate) return;

      // Apply category filter - scenario must be in filtered set
      const scenarioInFilter = scenarios.find((s: any) => s.id === scenarioId);
      if (!scenarioInFilter) return;

      if (!aggMap[scenarioId]) {
        aggMap[scenarioId] = { count: 0, totalScore: 0, scoreCount: 0, passCount: 0 };
      }

      aggMap[scenarioId].count += 1;

      if (a.overall_score !== null && a.overall_score !== undefined) {
        aggMap[scenarioId].totalScore += a.overall_score;
        aggMap[scenarioId].scoreCount += 1;
        if (a.overall_score >= PASS_THRESHOLD) {
          aggMap[scenarioId].passCount += 1;
        }
      } else {
        // No numeric score: use issue_level as proxy
        // 'none' = pass, 'minor' or 'needs_followup' = fail
        const issueLevel = a.issue_level || 'none';
        if (issueLevel === 'none') {
          aggMap[scenarioId].passCount += 1;
        }
      }
    });

    // Build final rows only for scenarios that have been assessed
    const scenarioRows = scenarios
      .filter((s: any) => aggMap[s.id]?.count > 0)
      .map((scenario: any) => {
        const agg = aggMap[scenario.id];
        const avgScore =
          agg.scoreCount > 0
            ? Math.round((agg.totalScore / agg.scoreCount) * 10) / 10
            : null;
        const passRate = Math.round((agg.passCount / agg.count) * 100);

        let performanceIndicator: string | null = null;
        if (passRate <= 50) {
          performanceIndicator = 'May be too hard';
        } else if (passRate >= 90) {
          performanceIndicator = 'May be too easy';
        }

        return {
          id: scenario.id,
          title: scenario.title,
          category: scenario.category ?? null,
          difficulty: scenario.difficulty ?? null,
          is_active: scenario.is_active ?? true,
          times_assessed: agg.count,
          avg_score: avgScore,
          pass_count: agg.passCount,
          fail_count: agg.count - agg.passCount,
          pass_rate: passRate,
          performance_indicator: performanceIndicator,
        };
      });

    // Default sort: pass_rate ascending (hardest first)
    scenarioRows.sort((a, b) => a.pass_rate - b.pass_rate);

    // Collect unique categories
    const allCategories: string[] = Array.from(
      new Set(
        scenarios
          .map((s: any) => s.category)
          .filter((c: string | null): c is string => !!c)
      )
    ).sort() as string[];

    // Summary stats
    const assessedCount = scenarioRows.length;
    const avgPassRate =
      assessedCount > 0
        ? Math.round(
            scenarioRows.reduce((sum, r) => sum + r.pass_rate, 0) / assessedCount
          )
        : null;

    // Hardest = lowest pass rate (first in sorted list)
    const hardestScenario = assessedCount > 0 ? scenarioRows[0] : null;
    // Easiest = highest pass rate (last in sorted list)
    const easiestScenario = assessedCount > 1 ? scenarioRows[assessedCount - 1] : null;

    return NextResponse.json({
      success: true,
      scenarios: scenarioRows,
      categories: allCategories,
      summary: {
        totalAssessed: assessedCount,
        avgPassRate,
        hardestScenario: hardestScenario
          ? {
              id: hardestScenario.id,
              title: hardestScenario.title,
              pass_rate: hardestScenario.pass_rate,
            }
          : null,
        easiestScenario: easiestScenario
          ? {
              id: easiestScenario.id,
              title: easiestScenario.title,
              pass_rate: easiestScenario.pass_rate,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error generating scenario analytics report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
