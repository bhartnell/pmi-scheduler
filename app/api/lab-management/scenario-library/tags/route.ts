import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/lab-management/scenario-library/tags
// Returns all distinct tags (optionally filtered by scenario_id)
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const scenarioId = request.nextUrl.searchParams.get('scenario_id');

  try {
    if (scenarioId) {
      // Return tags for a specific scenario
      const { data, error } = await supabase
        .from('scenario_tags')
        .select('id, tag')
        .eq('scenario_id', scenarioId)
        .order('tag');
      if (error) throw error;
      return NextResponse.json({ success: true, tags: data || [] });
    }

    // Return all distinct tags across the library
    const { data, error } = await supabase
      .from('scenario_tags')
      .select('tag')
      .order('tag');
    if (error) throw error;

    const uniqueTags = [...new Set((data || []).map((r) => r.tag))];
    return NextResponse.json({ success: true, tags: uniqueTags });
  } catch (error: any) {
    console.error('Error fetching scenario tags:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch tags' }, { status: 500 });
  }
}

// POST /api/lab-management/scenario-library/tags
// Add a tag to a scenario
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scenario_id, tag } = body;

    if (!scenario_id || !tag?.trim()) {
      return NextResponse.json({ error: 'scenario_id and tag are required' }, { status: 400 });
    }

    const normalizedTag = tag.trim();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('scenario_tags')
      .insert({ scenario_id, tag: normalizedTag })
      .select()
      .single();

    // Handle duplicate gracefully
    if (error && error.code !== '23505') throw error;
    if (error?.code === '23505') {
      // Already exists - fetch it
      const { data: existing } = await supabase
        .from('scenario_tags')
        .select('id, tag')
        .eq('scenario_id', scenario_id)
        .eq('tag', normalizedTag)
        .single();
      return NextResponse.json({ success: true, tag: existing }, { status: 200 });
    }

    return NextResponse.json({ success: true, tag: data }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding scenario tag:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to add tag' }, { status: 500 });
  }
}

// DELETE /api/lab-management/scenario-library/tags
// Remove a tag from a scenario
export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scenario_id, tag } = body;

    if (!scenario_id || !tag) {
      return NextResponse.json({ error: 'scenario_id and tag are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('scenario_tags')
      .delete()
      .eq('scenario_id', scenario_id)
      .eq('tag', tag);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing scenario tag:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to remove tag' }, { status: 500 });
  }
}
