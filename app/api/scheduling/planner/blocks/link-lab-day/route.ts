import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * POST: Create a lab day and link it to a schedule block
 * Body: { block_id, cohort_id, date, title?, semester?, week_number?, day_number? }
 *
 * Or link to an existing lab day:
 * Body: { block_id, lab_day_id }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { block_id, lab_day_id, cohort_id, date, title, semester, week_number, day_number } = body;

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let linkedLabDayId = lab_day_id;

    // If no existing lab_day_id, create a new lab day
    if (!linkedLabDayId) {
      if (!cohort_id || !date) {
        return NextResponse.json({ error: 'cohort_id and date are required to create a lab day' }, { status: 400 });
      }

      const { data: newLabDay, error: createError } = await supabase
        .from('lab_days')
        .insert({
          cohort_id,
          date,
          title: title || `Lab Day ${date}`,
          semester: semester || null,
          week_number: week_number || null,
          day_number: day_number || null,
        })
        .select('id, title, date')
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      linkedLabDayId = newLabDay.id;
    }

    // Link the block to the lab day
    const { error: updateError } = await supabase
      .from('pmi_schedule_blocks')
      .update({ linked_lab_day_id: linkedLabDayId })
      .eq('id', block_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fetch the linked lab day details
    const { data: labDay } = await supabase
      .from('lab_days')
      .select('id, title, date')
      .eq('id', linkedLabDayId)
      .single();

    // Count stations
    const { count: stationCount } = await supabase
      .from('lab_stations')
      .select('id', { count: 'exact', head: true })
      .eq('lab_day_id', linkedLabDayId);

    return NextResponse.json({
      success: true,
      linked_lab_day: labDay ? { ...labDay, station_count: stationCount || 0 } : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Link lab day error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
