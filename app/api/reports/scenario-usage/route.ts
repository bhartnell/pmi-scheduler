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

    // Fetch all scenarios (active and inactive) to also show unused ones
    let scenariosQuery = supabase
      .from('scenarios')
      .select('id, title, category, is_active')
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
          totalScenarios: 0,
          mostUsed: null,
          leastUsed: null,
          neverUsedCount: 0,
        },
      });
    }

    // Fetch all favorites for the current user so we can mark them
    const { data: favorites } = await supabase
      .from('scenario_favorites')
      .select('scenario_id')
      .eq('user_email', session.user.email);

    const favoriteIds = new Set((favorites || []).map((f: { scenario_id: string }) => f.scenario_id));

    // Fetch lab_stations with scenario_id set, joined to lab_days for date info
    // We do this in application code rather than raw SQL since Supabase JS doesn't support
    // aggregation via the client lib directly across joined tables with filtering.
    let stationsQuery = supabase
      .from('lab_stations')
      .select('scenario_id, lab_day_id, lab_day:lab_days(id, date)')
      .not('scenario_id', 'is', null);

    const { data: stations, error: stationsError } = await stationsQuery;
    if (stationsError) throw stationsError;

    // Build a map: scenario_id -> { count, lastUsedDate }
    const usageMap: Record<string, { count: number; lastUsedDate: string | null }> = {};

    (stations || []).forEach((station: any) => {
      const sid = station.scenario_id;
      if (!sid) return;

      // Apply date range filter based on the lab_day date
      const labDay = Array.isArray(station.lab_day) ? station.lab_day[0] : station.lab_day;
      const labDate: string | null = labDay?.date ?? null;

      if (startDate && labDate && labDate < startDate) return;
      if (endDate && labDate && labDate > endDate) return;
      // If no date (orphaned station), still count it unless date filters applied
      if ((startDate || endDate) && !labDate) return;

      if (!usageMap[sid]) {
        usageMap[sid] = { count: 0, lastUsedDate: null };
      }
      usageMap[sid].count += 1;
      if (labDate) {
        if (!usageMap[sid].lastUsedDate || labDate > usageMap[sid].lastUsedDate!) {
          usageMap[sid].lastUsedDate = labDate;
        }
      }
    });

    // Build the final scenario usage rows
    const scenarioRows = scenarios.map((scenario: any) => {
      const usage = usageMap[scenario.id] || { count: 0, lastUsedDate: null };
      return {
        id: scenario.id,
        title: scenario.title,
        category: scenario.category || null,
        is_active: scenario.is_active ?? true,
        usage_count: usage.count,
        last_used_date: usage.lastUsedDate,
        is_favorite: favoriteIds.has(scenario.id),
      };
    });

    // Sort by usage_count descending (highest first), then alphabetically for ties
    scenarioRows.sort((a, b) => {
      if (b.usage_count !== a.usage_count) return b.usage_count - a.usage_count;
      return a.title.localeCompare(b.title);
    });

    // Collect unique categories from all scenarios
    const allCategories: string[] = Array.from(
      new Set(
        scenarios
          .map((s: any) => s.category)
          .filter((c: string | null): c is string => !!c)
      )
    ).sort() as string[];

    // Summary stats
    const usedScenarios = scenarioRows.filter((s) => s.usage_count > 0);
    const neverUsedCount = scenarioRows.filter((s) => s.usage_count === 0).length;

    const mostUsed = usedScenarios.length > 0 ? usedScenarios[0] : null;
    const leastUsed =
      usedScenarios.length > 1
        ? usedScenarios[usedScenarios.length - 1]
        : null;

    return NextResponse.json({
      success: true,
      scenarios: scenarioRows,
      categories: allCategories,
      summary: {
        totalScenarios: scenarioRows.length,
        mostUsed: mostUsed
          ? { id: mostUsed.id, title: mostUsed.title, usage_count: mostUsed.usage_count }
          : null,
        leastUsed: leastUsed
          ? { id: leastUsed.id, title: leastUsed.title, usage_count: leastUsed.usage_count }
          : null,
        neverUsedCount,
      },
    });
  } catch (error) {
    console.error('Error generating scenario usage report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
