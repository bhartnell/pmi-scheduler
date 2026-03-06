import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch the original scenario
  const { data: original, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !original) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  // Strip fields that should be regenerated on insert
  const { id: _id, created_at: _created_at, updated_at: _updated_at, created_by: _created_by, ...scenarioData } = original;

  // Insert the duplicate with a modified title and fresh metadata
  const { data: newScenario, error: insertError } = await supabase
    .from('scenarios')
    .insert({
      ...scenarioData,
      title: `${original.title} (Copy)`,
      created_by: session.user.email,
      is_active: true,
    })
    .select('id, title')
    .single();

  if (insertError) {
    console.error('Error duplicating scenario:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(newScenario, { status: 201 });
}
