import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasMinRole, canManageContent } from '@/lib/permissions';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user with role
async function getCurrentUser(supabase: ReturnType<typeof getSupabase>, email: string) {
  const { data: user, error } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();

  if (error || !user) return null;
  return user;
}

/**
 * GET /api/stations/pool
 * Get all stations from the station pool
 * Query params: category, semester, cohortId, active (default true), withStats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const semester = searchParams.get('semester');
    const cohortId = searchParams.get('cohortId');
    const activeOnly = searchParams.get('active') !== 'false';
    const withStats = searchParams.get('withStats') === 'true';

    let query = supabase
      .from('station_pool')
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        created_by_user:lab_users!station_pool_created_by_fkey(id, name)
      `)
      .order('display_order', { ascending: true })
      .order('station_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (semester) {
      query = query.eq('semester', parseInt(semester));
    }

    if (cohortId) {
      query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
    }

    const { data: stations, error } = await query;

    if (error) {
      console.error('Error fetching station pool:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Optionally fetch completion stats
    let stationsWithStats = stations || [];
    if (withStats && stations && stations.length > 0) {
      const stationIds = stations.map(s => s.id);

      // Get completion counts per station
      const { data: completionStats, error: statsError } = await supabase
        .from('station_completions')
        .select('station_id, result')
        .in('station_id', stationIds);

      if (!statsError && completionStats) {
        const statsMap: Record<string, { pass: number; needs_review: number; incomplete: number; total: number }> = {};

        completionStats.forEach((c: { station_id: string; result: string }) => {
          if (!statsMap[c.station_id]) {
            statsMap[c.station_id] = { pass: 0, needs_review: 0, incomplete: 0, total: 0 };
          }
          statsMap[c.station_id][c.result as 'pass' | 'needs_review' | 'incomplete']++;
          statsMap[c.station_id].total++;
        });

        stationsWithStats = stations.map(station => ({
          ...station,
          completion_stats: statsMap[station.id] || { pass: 0, needs_review: 0, incomplete: 0, total: 0 }
        }));
      }
    }

    return NextResponse.json({
      success: true,
      stations: stationsWithStats,
      total: stationsWithStats.length
    });
  } catch (error) {
    console.error('Error fetching station pool:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch station pool' }, { status: 500 });
  }
}

/**
 * POST /api/stations/pool
 * Create a new station in the pool
 * Requires instructor+ role
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUser(supabase, session.user.email);
    if (!user || !hasMinRole(user.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.station_code?.trim()) {
      return NextResponse.json({ success: false, error: 'Station code is required' }, { status: 400 });
    }

    if (!body.station_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Station name is required' }, { status: 400 });
    }

    // Check for duplicate station code
    const { data: existing } = await supabase
      .from('station_pool')
      .select('id')
      .eq('station_code', body.station_code.trim())
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Station code already exists' }, { status: 400 });
    }

    const { data: station, error } = await supabase
      .from('station_pool')
      .insert({
        station_code: body.station_code.trim(),
        station_name: body.station_name.trim(),
        category: body.category || 'other',
        description: body.description?.trim() || null,
        semester: body.semester || 3,
        cohort_id: body.cohort_id || null,
        is_active: body.is_active !== false,
        display_order: body.display_order || 0,
        created_by: user.id,
      })
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation)),
        created_by_user:lab_users!station_pool_created_by_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating station:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, station });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json({ success: false, error: 'Failed to create station' }, { status: 500 });
  }
}
