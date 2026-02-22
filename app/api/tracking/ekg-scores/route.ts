import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasMinRole } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

// Create Supabase client lazily to avoid build-time errors
// Helper to get current user with role
async function getCurrentUser(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data: user, error } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();

  if (error || !user) return null;
  return user;
}

/**
 * GET /api/tracking/ekg-scores
 * Get EKG warmup scores with filters
 * Query params: studentId, cohortId, startDate, endDate, baselineOnly
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');
    const cohortId = searchParams.get('cohortId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const baselineOnly = searchParams.get('baselineOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('ekg_warmup_scores')
      .select(`
        *,
        student:students(id, first_name, last_name, cohort_id),
        logged_by_user:lab_users!ekg_warmup_scores_logged_by_fkey(id, name)
      `, { count: 'exact' })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (cohortId) {
      // Filter by cohort via student relation
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('cohort_id', cohortId);

      if (students && students.length > 0) {
        const studentIds = students.map(s => s.id);
        query = query.in('student_id', studentIds);
      } else {
        // No students in cohort, return empty
        return NextResponse.json({
          success: true,
          scores: [],
          total: 0,
          limit,
          offset
        });
      }
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    if (baselineOnly) {
      query = query.eq('is_baseline', true);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching EKG scores:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scores: data,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching EKG scores:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch EKG scores' }, { status: 500 });
  }
}

/**
 * POST /api/tracking/ekg-scores
 * Log a new EKG warmup score
 * Requires instructor+ role
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
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

    if (body.score === undefined || body.score === null) {
      return NextResponse.json({ success: false, error: 'Score is required' }, { status: 400 });
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

    const { data: ekgScore, error } = await supabase
      .from('ekg_warmup_scores')
      .insert({
        student_id: body.student_id,
        score: body.score,
        max_score: body.max_score || 10,
        is_baseline: body.is_baseline || false,
        is_self_reported: body.is_self_reported || false,
        missed_rhythms: body.missed_rhythms || null,
        logged_by: user.id,
        date: body.date || new Date().toISOString().split('T')[0],
        notes: body.notes?.trim() || null,
      })
      .select(`
        *,
        student:students(id, first_name, last_name),
        logged_by_user:lab_users!ekg_warmup_scores_logged_by_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error logging EKG score:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, score: ekgScore });
  } catch (error) {
    console.error('Error logging EKG score:', error);
    return NextResponse.json({ success: false, error: 'Failed to log EKG score' }, { status: 500 });
  }
}
