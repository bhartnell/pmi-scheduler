import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// POST /api/lvfr-aemt/planner/placements/move — Move a block to new day/time or reorder within a day
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { placement_id, new_day_number, new_start_time, new_sort_order } = body;

    if (!placement_id) {
      return NextResponse.json({ error: 'placement_id is required' }, { status: 400 });
    }

    // For cross-day moves, require day_number and start_time
    // For within-day reorder, only sort_order is needed
    if (new_sort_order === undefined || new_sort_order === null) {
      if (!new_day_number || !new_start_time) {
        return NextResponse.json({ error: 'new_day_number and new_start_time are required for cross-day moves' }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();

    // Get the existing placement with duration from content block
    const { data: placement, error: fetchError } = await supabase
      .from('lvfr_aemt_plan_placements')
      .select('*, content_block:lvfr_aemt_content_blocks!lvfr_aemt_plan_placements_content_block_id_fkey(duration_min, name, block_type)')
      .eq('id', placement_id)
      .single();

    if (fetchError) {
      console.error('Move placement fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch placement: ' + fetchError.message }, { status: 500 });
    }

    if (!placement) {
      return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
    }

    const duration = placement.content_block?.duration_min || placement.duration_min || 30;
    const targetDay = new_day_number || placement.day_number;
    const targetStartTime = new_start_time || placement.start_time;

    // Calculate new end_time
    const [h, m] = targetStartTime.split(':').map(Number);
    const total = h * 60 + m + duration;
    const newEndTime = String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');

    // Calculate new date for cross-day moves
    let newDate = placement.date;
    if (new_day_number && new_day_number !== placement.day_number) {
      const { data: instance } = await supabase
        .from('lvfr_aemt_plan_instances')
        .select('start_date')
        .eq('id', placement.instance_id)
        .single();

      if (instance) {
        const weekIndex = Math.floor((new_day_number - 1) / 3);
        const dayInWeek = (new_day_number - 1) % 3;
        const daysToAdd = weekIndex * 7 + dayInWeek;
        const d = new Date(instance.start_date + 'T12:00:00');
        d.setDate(d.getDate() + daysToAdd);
        newDate = d.toISOString().split('T')[0];
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      day_number: targetDay,
      date: newDate,
      start_time: targetStartTime,
      end_time: newEndTime,
      updated_at: new Date().toISOString(),
    };

    if (new_sort_order !== undefined && new_sort_order !== null) {
      updateData.sort_order = new_sort_order;
    }

    // Update the placement
    const { data: updated, error: updateError } = await supabase
      .from('lvfr_aemt_plan_placements')
      .update(updateData)
      .eq('id', placement_id)
      .select()
      .single();

    if (updateError) {
      console.error('Move placement update error:', updateError);
      return NextResponse.json({ error: 'Failed to update placement: ' + updateError.message }, { status: 500 });
    }

    // Check prerequisites
    const violations: Array<{ block_id: string; requires_block_id: string; rule_type: string; message: string }> = [];

    try {
      const { data: prereqs } = await supabase
        .from('lvfr_aemt_prerequisites')
        .select('requires_block_id, rule_type')
        .eq('block_id', placement.content_block_id);

      if (prereqs && prereqs.length > 0) {
        const { data: allPlacements } = await supabase
          .from('lvfr_aemt_plan_placements')
          .select('content_block_id, day_number')
          .eq('instance_id', placement.instance_id);

        const placedBlocks = new Map<string, number>();
        for (const p of (allPlacements || [])) {
          placedBlocks.set(p.content_block_id, p.day_number);
        }

        for (const prereq of prereqs) {
          const reqDay = placedBlocks.get(prereq.requires_block_id);
          if (reqDay === undefined) {
            violations.push({
              block_id: placement.content_block_id,
              requires_block_id: prereq.requires_block_id,
              rule_type: prereq.rule_type,
              message: prereq.requires_block_id + ' is not yet placed',
            });
          } else if (prereq.rule_type === 'must_precede' && reqDay >= targetDay) {
            violations.push({
              block_id: placement.content_block_id,
              requires_block_id: prereq.requires_block_id,
              rule_type: prereq.rule_type,
              message: prereq.requires_block_id + ' must come before day ' + targetDay,
            });
          }
        }
      }
    } catch (prereqErr) {
      console.error('Prerequisite check error (non-fatal):', prereqErr);
    }

    return NextResponse.json({ placement: updated, violations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Move placement error:', err);
    return NextResponse.json({ error: 'Move failed: ' + message }, { status: 500 });
  }
}
