import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/lab-management/scenario-library/ratings
// Upsert a rating for a scenario (one per user per scenario)
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scenario_id, rating, comment } = body;

    if (!scenario_id) {
      return NextResponse.json({ error: 'scenario_id is required' }, { status: 400 });
    }
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scenario_ratings')
      .upsert(
        {
          scenario_id,
          user_email: session.user.email,
          rating,
          comment: comment || null,
        },
        { onConflict: 'scenario_id,user_email' }
      )
      .select()
      .single();

    if (error) throw error;

    // Return updated avg for the scenario
    const { data: allRatings } = await supabase
      .from('scenario_ratings')
      .select('rating')
      .eq('scenario_id', scenario_id);

    const count = allRatings?.length || 0;
    const avg =
      count > 0
        ? Math.round((allRatings!.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
        : 0;

    return NextResponse.json({ success: true, rating: data, avg_rating: avg, rating_count: count });
  } catch (error: any) {
    console.error('Error saving scenario rating:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save rating' }, { status: 500 });
  }
}

// DELETE /api/lab-management/scenario-library/ratings
// Remove the current user's rating for a scenario
export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scenario_id } = body;

    if (!scenario_id) {
      return NextResponse.json({ error: 'scenario_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('scenario_ratings')
      .delete()
      .eq('scenario_id', scenario_id)
      .eq('user_email', session.user.email);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing scenario rating:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to remove rating' }, { status: 500 });
  }
}
