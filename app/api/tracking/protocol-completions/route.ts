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

// Valid protocol categories
const VALID_CATEGORIES = [
  'cardiac',
  'respiratory',
  'trauma',
  'medical',
  'pediatric',
  'obstetric',
  'behavioral',
  'other'
];

/**
 * GET /api/tracking/protocol-completions
 * Get protocol completions with filters
 * Query params: studentId, cohortId, category
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
    const cohortId = searchParams.get('cohortId');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('protocol_completions')
      .select(`
        *,
        student:students(id, first_name, last_name, cohort_id),
        logged_by_user:lab_users!protocol_completions_logged_by_fkey(id, name)
      `, { count: 'exact' })
      .order('completed_at', { ascending: false });

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
          completions: [],
          total: 0,
          limit,
          offset
        });
      }
    }

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json({
          success: false,
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
        }, { status: 400 });
      }
      query = query.eq('protocol_category', category);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching protocol completions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      completions: data,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching protocol completions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch protocol completions' }, { status: 500 });
  }
}

/**
 * POST /api/tracking/protocol-completions
 * Log a protocol completion
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

    if (!body.protocol_category || !VALID_CATEGORIES.includes(body.protocol_category)) {
      return NextResponse.json({
        success: false,
        error: `Valid protocol category is required (${VALID_CATEGORIES.join(', ')})`
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

    const { data: completion, error } = await supabase
      .from('protocol_completions')
      .insert({
        student_id: body.student_id,
        protocol_category: body.protocol_category,
        case_count: body.case_count || 1,
        logged_by: user.id,
        notes: body.notes?.trim() || null,
      })
      .select(`
        *,
        student:students(id, first_name, last_name),
        logged_by_user:lab_users!protocol_completions_logged_by_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error logging protocol completion:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, completion });
  } catch (error) {
    console.error('Error logging protocol completion:', error);
    return NextResponse.json({ success: false, error: 'Failed to log protocol completion' }, { status: 500 });
  }
}
