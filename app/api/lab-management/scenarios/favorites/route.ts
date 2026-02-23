import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scenario_favorites')
      .select('scenario_id')
      .eq('user_email', session.user.email);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching scenario favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

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
      .insert({ user_email: session.user.email, scenario_id })
      .select()
      .single();

    // Handle duplicate gracefully - unique constraint violation
    if (error && error.code !== '23505') {
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error adding scenario favorite:', error);
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
  }
}

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
      .eq('user_email', session.user.email)
      .eq('scenario_id', scenario_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing scenario favorite:', error);
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
