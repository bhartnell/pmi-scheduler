import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasMinRole, isStudent } from '@/lib/permissions';

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
 * GET /api/stations/completions
 * Get station completions
 * Query params: studentId, stationId, result, startDate, endDate, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');
    const stationId = searchParams.get('stationId');
    const result = searchParams.get('result');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const cohortId = searchParams.get('cohortId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('station_completions')
      .select(`
        *,
        student:students(id, first_name, last_name, cohort_id, cohort:cohorts(id, cohort_number)),
        station:station_pool(id, station_code, station_name, category),
        logged_by_user:lab_users!station_completions_logged_by_fkey(id, name),
        lab_day:lab_days(id, date)
      `, { count: 'exact' })
      .order('completed_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (stationId) {
      query = query.eq('station_id', stationId);
    }

    if (result) {
      query = query.eq('result', result);
    }

    if (startDate) {
      query = query.gte('completed_at', startDate);
    }

    if (endDate) {
      query = query.lte('completed_at', endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching completions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // If cohortId filter requested, filter results (post-query since it's a nested field)
    let filteredData = data || [];
    if (cohortId && filteredData.length > 0) {
      filteredData = filteredData.filter((c: any) => c.student?.cohort_id === cohortId);
    }

    return NextResponse.json({
      success: true,
      completions: filteredData,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching completions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch completions' }, { status: 500 });
  }
}

/**
 * POST /api/stations/completions
 * Log a station completion
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
      return NextResponse.json({ success: false, error: 'Instructor access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.student_id) {
      return NextResponse.json({ success: false, error: 'Student ID is required' }, { status: 400 });
    }

    if (!body.station_id) {
      return NextResponse.json({ success: false, error: 'Station ID is required' }, { status: 400 });
    }

    if (!body.result || !['pass', 'needs_review', 'incomplete'].includes(body.result)) {
      return NextResponse.json({ success: false, error: 'Valid result is required (pass, needs_review, incomplete)' }, { status: 400 });
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', body.student_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    }

    // Verify station exists
    const { data: station, error: stationError } = await supabase
      .from('station_pool')
      .select('id')
      .eq('id', body.station_id)
      .single();

    if (stationError || !station) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 });
    }

    const { data: completion, error } = await supabase
      .from('station_completions')
      .insert({
        student_id: body.student_id,
        station_id: body.station_id,
        result: body.result,
        completed_at: body.completed_at || new Date().toISOString(),
        logged_by: user.id,
        lab_day_id: body.lab_day_id || null,
        notes: body.notes?.trim() || null,
      })
      .select(`
        *,
        student:students(id, first_name, last_name),
        station:station_pool(id, station_code, station_name, category),
        logged_by_user:lab_users!station_completions_logged_by_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error logging completion:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, completion });
  } catch (error) {
    console.error('Error logging completion:', error);
    return NextResponse.json({ success: false, error: 'Failed to log completion' }, { status: 500 });
  }
}
