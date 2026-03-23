import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { semester_id } = body;

    if (!semester_id) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Find the program_schedule_ids for this semester
    const { data: schedules } = await supabase
      .from('pmi_program_schedules')
      .select('id')
      .eq('semester_id', semester_id);

    const scheduleIds = schedules?.map(s => s.id) || [];

    if (scheduleIds.length === 0) {
      // Also try direct semester_id on blocks
      const { data: updated, error } = await supabase
        .from('pmi_schedule_blocks')
        .update({ status: 'published' })
        .eq('semester_id', semester_id)
        .eq('status', 'draft')
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ count: updated?.length || 0 });
    }

    // Update all draft blocks for these program schedules
    const { data: updated, error } = await supabase
      .from('pmi_schedule_blocks')
      .update({ status: 'published' })
      .eq('status', 'draft')
      .in('program_schedule_id', scheduleIds)
      .select('id');

    if (error) {
      // Try with semester_id directly as fallback
      const { data: updated2, error: error2 } = await supabase
        .from('pmi_schedule_blocks')
        .update({ status: 'published' })
        .eq('semester_id', semester_id)
        .eq('status', 'draft')
        .select('id');

      if (error2) {
        return NextResponse.json({ error: error2.message }, { status: 500 });
      }

      return NextResponse.json({ count: updated2?.length || 0 });
    }

    // Also publish blocks with direct semester_id reference (unlinked blocks)
    const { data: unlinkedUpdated } = await supabase
      .from('pmi_schedule_blocks')
      .update({ status: 'published' })
      .eq('semester_id', semester_id)
      .eq('status', 'draft')
      .is('program_schedule_id', null)
      .select('id');

    const totalCount = (updated?.length || 0) + (unlinkedUpdated?.length || 0);

    return NextResponse.json({ count: totalCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
