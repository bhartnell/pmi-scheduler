import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/lab-management/scenario-library/clone
// Clone a scenario with an optional new name
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scenario_id, new_title } = body;

    if (!scenario_id) {
      return NextResponse.json({ error: 'scenario_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the original scenario
    const { data: original, error: fetchError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenario_id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Strip identity / audit fields
    const {
      id: _id,
      created_at: _ca,
      updated_at: _ua,
      created_by: _cb,
      ...scenarioData
    } = original;

    const cloneTitle = new_title?.trim() || `${original.title} (Copy)`;

    // Insert the clone
    const { data: cloned, error: insertError } = await supabase
      .from('scenarios')
      .insert({
        ...scenarioData,
        title: cloneTitle,
        created_by: session.user.email,
        is_active: true,
      })
      .select('id, title')
      .single();

    if (insertError) {
      console.error('Error cloning scenario:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Copy tags from the original to the clone
    const { data: originalTags } = await supabase
      .from('scenario_tags')
      .select('tag')
      .eq('scenario_id', scenario_id);

    if (originalTags && originalTags.length > 0) {
      await supabase.from('scenario_tags').insert(
        originalTags.map((t) => ({ scenario_id: cloned.id, tag: t.tag }))
      );
    }

    return NextResponse.json({ success: true, scenario: cloned }, { status: 201 });
  } catch (error: any) {
    console.error('Error cloning scenario:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to clone scenario' }, { status: 500 });
  }
}
