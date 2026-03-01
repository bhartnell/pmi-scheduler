import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/lab-management/scenario-library/favorites
// Add a scenario to favorites
export async function POST(request: NextRequest) {
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
      .from('scenario_favorites')
      .insert({ scenario_id, user_email: session.user.email });

    // Ignore duplicate - already favorited
    if (error && error.code !== '23505') throw error;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding favorite:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to add favorite' }, { status: 500 });
  }
}

// DELETE /api/lab-management/scenario-library/favorites
// Remove a scenario from favorites
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
      .from('scenario_favorites')
      .delete()
      .eq('scenario_id', scenario_id)
      .eq('user_email', session.user.email);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing favorite:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to remove favorite' }, { status: 500 });
  }
}
