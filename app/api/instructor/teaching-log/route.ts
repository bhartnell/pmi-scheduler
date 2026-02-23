import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// Get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const instructorId = searchParams.get('instructorId') || currentUser.id;
    const year = searchParams.get('year');

    // Only admins can view other instructors' teaching logs
    if (instructorId !== currentUser.id && currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    let query = supabase
      .from('teaching_log')
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(abbreviation)),
        lab_day:lab_days(id, title, date)
      `)
      .eq('instructor_id', instructorId)
      .order('date_taught', { ascending: false });

    if (year) {
      query = query
        .gte('date_taught', `${year}-01-01`)
        .lte('date_taught', `${year}-12-31`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate summary stats
    const entries = data || [];
    const totalClasses = entries.length;
    const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    const totalStudents = entries.reduce((sum, e) => sum + (e.student_count || 0), 0);

    return NextResponse.json({
      success: true,
      entries,
      stats: {
        totalClasses,
        totalHours,
        totalStudents
      }
    });
  } catch (error) {
    console.error('Error fetching teaching log:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch teaching log' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.course_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Course name is required' }, { status: 400 });
    }
    if (!body.date_taught) {
      return NextResponse.json({ success: false, error: 'Date taught is required' }, { status: 400 });
    }
    if (!body.hours || body.hours <= 0) {
      return NextResponse.json({ success: false, error: 'Hours must be greater than 0' }, { status: 400 });
    }

    const teachingEntry = {
      instructor_id: currentUser.id,
      certification_id: body.certification_id || null,
      course_name: body.course_name.trim(),
      course_type: body.course_type || null,
      date_taught: body.date_taught,
      hours: parseFloat(body.hours),
      location: body.location || null,
      student_count: body.student_count ? parseInt(body.student_count) : null,
      cohort_id: body.cohort_id || null,
      lab_day_id: body.lab_day_id || null,
      notes: body.notes || null
    };

    const { data, error } = await supabase
      .from('teaching_log')
      .insert(teachingEntry)
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(abbreviation)),
        lab_day:lab_days(id, title, date)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Error creating teaching entry:', error);
    return NextResponse.json({ success: false, error: 'Failed to create teaching entry' }, { status: 500 });
  }
}
