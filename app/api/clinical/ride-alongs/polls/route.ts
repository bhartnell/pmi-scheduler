import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/clinical/ride-alongs/polls — list all polls (auth required)
export async function GET() {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('ride_along_polls')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, polls: data || [] });
  } catch (error) {
    console.error('Error fetching ride-along polls:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch polls' },
      { status: 500 }
    );
  }
}

// POST /api/clinical/ride-alongs/polls — create a new poll (auth required)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { cohort_id, semester_id, title, deadline } = body;

    if (!cohort_id) {
      return NextResponse.json(
        { success: false, error: 'cohort_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('ride_along_polls')
      .insert({
        cohort_id,
        semester_id: semester_id || null,
        title: title || 'EMT Ride-Along Availability',
        deadline: deadline || null,
        status: 'active',
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, poll: data });
  } catch (error) {
    console.error('Error creating ride-along poll:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}
