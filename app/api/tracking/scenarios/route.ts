import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasMinRole } from '@/lib/permissions';

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
 * GET /api/tracking/scenarios
 * Get scenario participation records
 * Query params: studentId, scenarioId, role, startDate, endDate, labDayId
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
    const scenarioId = searchParams.get('scenarioId');
    const role = searchParams.get('role');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const labDayId = searchParams.get('labDayId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('scenario_participation')
      .select(`
        *,
        student:students(id, first_name, last_name, cohort_id),
        scenario:scenarios(id, title, category),
        logged_by_user:lab_users!scenario_participation_logged_by_fkey(id, name),
        lab_day:lab_days(id, date)
      `, { count: 'exact' })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching scenario participation:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      participation: data,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching scenario participation:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch participation' }, { status: 500 });
  }
}

/**
 * POST /api/tracking/scenarios
 * Log scenario participation for a student
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

    const validRoles = ['team_lead', 'med_tech', 'monitor_tech', 'airway_tech', 'observer'];
    if (!body.role || !validRoles.includes(body.role)) {
      return NextResponse.json({
        success: false,
        error: `Valid role is required (${validRoles.join(', ')})`
      }, { status: 400 });
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

    // Build scenario name from scenario_id if provided
    let scenarioName = body.scenario_name || null;
    if (body.scenario_id && !scenarioName) {
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('title')
        .eq('id', body.scenario_id)
        .single();

      if (scenario) {
        scenarioName = scenario.title;
      }
    }

    const { data: participation, error } = await supabase
      .from('scenario_participation')
      .insert({
        student_id: body.student_id,
        scenario_id: body.scenario_id || null,
        scenario_name: scenarioName,
        role: body.role,
        lab_day_id: body.lab_day_id || null,
        date: body.date || new Date().toISOString().split('T')[0],
        logged_by: user.id,
        notes: body.notes?.trim() || null,
      })
      .select(`
        *,
        student:students(id, first_name, last_name),
        scenario:scenarios(id, title, category),
        logged_by_user:lab_users!scenario_participation_logged_by_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error logging scenario participation:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, participation });
  } catch (error) {
    console.error('Error logging scenario participation:', error);
    return NextResponse.json({ success: false, error: 'Failed to log participation' }, { status: 500 });
  }
}
