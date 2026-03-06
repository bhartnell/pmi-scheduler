import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/lab-management/lab-days/[id]/ratings
// Fetch all ratings for a lab day
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const { data, error } = await supabase
      .from('student_lab_ratings')
      .select(`
        *,
        student:students(id, first_name, last_name, photo_url)
      `)
      .eq('lab_day_id', labDayId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, ratings: data || [] });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ratings' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/ratings
// Submit or update a rating (upsert on unique constraint)
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();



  try {
    const body = await request.json();
    const { student_id, rating, note } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating is required and must be between 1 and 5' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('student_lab_ratings')
      .upsert(
        {
          lab_day_id: labDayId,
          student_id,
          instructor_email: user.email,
          rating,
          note: note?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lab_day_id,student_id,instructor_email' }
      )
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, rating: data });
  } catch (error) {
    console.error('Error saving rating:', error);
    return NextResponse.json({ success: false, error: 'Failed to save rating' }, { status: 500 });
  }
}
