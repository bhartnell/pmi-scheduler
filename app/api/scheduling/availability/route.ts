import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET - List availability entries
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const instructorId = searchParams.get('instructor_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const viewAll = searchParams.get('view_all') === 'true';

    const supabase = getSupabase();

    let query = supabase
      .from('instructor_availability')
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    // Filter by instructor (default to current user unless viewing all)
    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    } else if (!viewAll) {
      // Default to current user's availability
      query = query.eq('instructor_id', currentUser.id);
    }

    // Date range filter
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: availability, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, availability: availability || [] });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch availability' }, { status: 500 });
  }
}

// POST - Create availability entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { date, start_time, end_time, is_all_day, notes } = body;

    if (!date) {
      return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 });
    }

    // Validate times if not all day
    if (!is_all_day && (!start_time || !end_time)) {
      return NextResponse.json(
        { success: false, error: 'Start and end times are required for non-all-day availability' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: entry, error } = await supabase
      .from('instructor_availability')
      .insert({
        instructor_id: currentUser.id,
        date,
        start_time: is_all_day ? null : start_time,
        end_time: is_all_day ? null : end_time,
        is_all_day: is_all_day || false,
        notes: notes || null,
      })
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'You already have availability for this date/time' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, availability: entry });
  } catch (error) {
    console.error('Error creating availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to create availability' }, { status: 500 });
  }
}
