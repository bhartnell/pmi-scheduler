import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    // 1. Fetch all scenarios
    const { data: scenarios } = await supabase
      .from('scenarios')
      .select('id, title, category, difficulty, is_active, created_at')
      .order('title');

    const scenarioList = scenarios || [];
    const totalScenarios = scenarioList.length;
    const activeScenarios = scenarioList.filter((s) => s.is_active).length;

    // 2. Fetch lab_stations with scenario references
    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, scenario_id, lab_day_id, lab_day:lab_days(date)')
      .not('scenario_id', 'is', null);

    // Usage count per scenario
    const usageCounts: Record<string, { count: number; lastDate: string | null }> = {};
    (stations || []).forEach((s) => {
      if (!s.scenario_id) return;
      if (!usageCounts[s.scenario_id]) {
        usageCounts[s.scenario_id] = { count: 0, lastDate: null };
      }
      usageCounts[s.scenario_id].count++;
      const labDay = Array.isArray(s.lab_day) ? s.lab_day[0] : s.lab_day;
      const date = labDay?.date;
      if (date) {
        if (!usageCounts[s.scenario_id].lastDate || date > usageCounts[s.scenario_id].lastDate!) {
          usageCounts[s.scenario_id].lastDate = date;
        }
      }
    });

    // 3. Build usage data with scenario info
    const usageData = scenarioList.map((scenario) => ({
      id: scenario.id,
      name: scenario.title,
      category: scenario.category || 'Uncategorized',
      difficulty: scenario.difficulty || 'Unrated',
      is_active: scenario.is_active,
      usage_count: usageCounts[scenario.id]?.count || 0,
      last_used: usageCounts[scenario.id]?.lastDate || null,
    }));

    // Top 20 by usage
    const topByUsage = [...usageData]
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 20);

    // 4. Difficulty distribution
    const difficultyDist: Record<string, number> = {};
    scenarioList.forEach((s) => {
      const diff = s.difficulty || 'Unrated';
      difficultyDist[diff] = (difficultyDist[diff] || 0) + 1;
    });

    const difficultyDistribution = Object.entries(difficultyDist).map(([name, value]) => ({
      name,
      value,
    }));

    // 5. Category distribution
    const categoryDist: Record<string, number> = {};
    scenarioList.forEach((s) => {
      const cat = s.category || 'Uncategorized';
      categoryDist[cat] = (categoryDist[cat] || 0) + 1;
    });

    const categoryDistribution = Object.entries(categoryDist)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 6. Categories used
    const categoriesUsed = new Set(scenarioList.map((s) => s.category).filter(Boolean)).size;

    const response = NextResponse.json({
      success: true,
      total_scenarios: totalScenarios,
      active_scenarios: activeScenarios,
      categories_used: categoriesUsed,
      top_by_usage: topByUsage,
      difficulty_distribution: difficultyDistribution,
      category_distribution: categoryDistribution,
      all_scenarios: usageData,
    });

    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error generating scenario usage report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
