import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const scenarioId: string | null =
      body?.scenario_id === undefined ? null : body.scenario_id;

    const supabase = getSupabaseAdmin();

    // Load current station metadata
    const { data: existing, error: fetchError } = await supabase
      .from('lab_stations')
      .select('id, metadata')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    const currentMetadata =
      (existing.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {}) || {};

    const mergedMetadata: Record<string, unknown> = {
      ...currentMetadata,
      selected_scenario_id: scenarioId,
    };

    const { data: updated, error: updateError } = await supabase
      .from('lab_stations')
      .update({ metadata: mergedMetadata })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating station scenario:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update station' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, station: updated });
  } catch (error) {
    console.error('Error in POST /api/lab-management/stations/[id]/scenario:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
