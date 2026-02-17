import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Key clinical sites that require regular visits during Semester 3
const KEY_SITES = ['Siena', 'SHMC', 'SVH']; // St Rose Siena, Summerlin, Spring Valley

// Default days threshold for alerts (no visits in X days = alert)
const DEFAULT_DAYS_THRESHOLD = 7;

interface SiteCoverage {
  siteId: string;
  siteName: string;
  abbreviation: string;
  lastVisitDate: string | null;
  daysSinceVisit: number | null;
  visitsThisMonth: number;
  isKeysite: boolean;
  needsAttention: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const daysThreshold = parseInt(searchParams.get('daysThreshold') || String(DEFAULT_DAYS_THRESHOLD));
    const keySitesOnly = searchParams.get('keySitesOnly') === 'true';
    const cohortId = searchParams.get('cohortId');

    // Check if any cohorts are in Semester 3 (clinical semester)
    const { data: activeClinicalCohorts, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, current_semester, program:programs(abbreviation)')
      .eq('is_active', true)
      .eq('current_semester', 3);

    if (cohortError) throw cohortError;

    const hasSemester3Cohorts = (activeClinicalCohorts?.length || 0) > 0;

    // Get all active clinical sites
    let sitesQuery = supabase
      .from('clinical_sites')
      .select('id, name, abbreviation')
      .eq('is_active', true);

    if (keySitesOnly) {
      sitesQuery = sitesQuery.in('abbreviation', KEY_SITES);
    }

    const { data: sites, error: sitesError } = await sitesQuery;

    if (sitesError) throw sitesError;

    // Get visit statistics for each site
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

    const coverage: SiteCoverage[] = [];

    for (const site of sites || []) {
      // Get the most recent visit for this site
      let lastVisitQuery = supabase
        .from('clinical_site_visits')
        .select('visit_date')
        .eq('site_id', site.id)
        .order('visit_date', { ascending: false })
        .limit(1);

      // Optionally filter by cohort
      if (cohortId) {
        lastVisitQuery = lastVisitQuery.eq('cohort_id', cohortId);
      }

      const { data: lastVisit } = await lastVisitQuery;

      // Get visit count this month
      let monthCountQuery = supabase
        .from('clinical_site_visits')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id)
        .gte('visit_date', monthStart);

      if (cohortId) {
        monthCountQuery = monthCountQuery.eq('cohort_id', cohortId);
      }

      const { count: monthCount } = await monthCountQuery;

      // Calculate days since last visit
      let daysSinceVisit: number | null = null;
      const lastVisitDate = lastVisit?.[0]?.visit_date || null;

      if (lastVisitDate) {
        const lastDate = new Date(lastVisitDate + 'T00:00:00');
        daysSinceVisit = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      const isKeysite = KEY_SITES.includes(site.abbreviation);
      const needsAttention = isKeysite && (daysSinceVisit === null || daysSinceVisit >= daysThreshold);

      coverage.push({
        siteId: site.id,
        siteName: site.name,
        abbreviation: site.abbreviation,
        lastVisitDate,
        daysSinceVisit,
        visitsThisMonth: monthCount || 0,
        isKeysite,
        needsAttention
      });
    }

    // Sort: key sites first, then by needs attention, then by days since visit
    coverage.sort((a, b) => {
      if (a.isKeysite !== b.isKeysite) return b.isKeysite ? 1 : -1;
      if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
      if (a.daysSinceVisit === null) return 1;
      if (b.daysSinceVisit === null) return -1;
      return b.daysSinceVisit - a.daysSinceVisit;
    });

    // Get sites needing attention
    const sitesNeedingAttention = coverage.filter(c => c.needsAttention);

    return NextResponse.json({
      success: true,
      coverage,
      sitesNeedingAttention,
      hasSemester3Cohorts,
      activeClinicalCohorts: activeClinicalCohorts || [],
      keySites: KEY_SITES,
      daysThreshold,
      summary: {
        totalSites: coverage.length,
        keySiteCount: coverage.filter(c => c.isKeysite).length,
        sitesNeedingAttention: sitesNeedingAttention.length,
        averageVisitsThisMonth: coverage.length > 0
          ? (coverage.reduce((sum, c) => sum + c.visitsThisMonth, 0) / coverage.length).toFixed(1)
          : 0
      }
    });
  } catch (error) {
    console.error('Error checking site visit coverage:', error);
    return NextResponse.json({ success: false, error: 'Failed to check coverage' }, { status: 500 });
  }
}
