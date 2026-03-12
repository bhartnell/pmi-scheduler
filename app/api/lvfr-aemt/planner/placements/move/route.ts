import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// POST /api/lvfr-aemt/planner/placements/move — Move a block to new day/time
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { placement_id, new_day_number, new_start_time } = body;

  if (!placement_id || !new_day_number || !new_start_time) {
    return NextResponse.json({ error: 'placement_id, new_day_number, and new_start_time are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Get the existing placement
  const { data: placement } = await supabase
    .from('lvfr_aemt_plan_placements')
    .select('*, content_block:lvfr_aemt_content_blocks!lvfr_aemt_plan_placements_content_block_id_fkey(duration_min)')
    .eq('id', placement_id)
    .single();

  if (!placement) {
    return NextResponse.json({ error: 'Placement not found' }, { status: 404 });
  }

  // Calculate new end_time
  const duration = placement.content_block?.duration_min || placement.duration_min;
  const [h, m] = new_start_time.split(':').map(Number);
  const total = h * 60 + m + duration;
  const newEndTime = String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');

  // Calculate new date
  const { data: instance } = await supabase
    .from('lvfr_aemt_plan_instances')
    .select('start_date')
    .eq('id', placement.instance_id)
    .single();

  let newDate = null;
  if (instance) {
    const weekIndex = Math.floor((new_day_number - 1) / 3);
    const dayInWeek = (new_day_number - 1) % 3;
    const daysToAdd = weekIndex * 7 + dayInWeek;
    const d = new Date(instance.start_date + 'T12:00:00');
    d.setDate(d.getDate() + daysToAdd);
    newDate = d.toISOString().split('T')[0];
  }

  // Update the placement
  const { data: updated, error } = await supabase
    .from('lvfr_aemt_plan_placements')
    .update({
      day_number: new_day_number,
      date: newDate,
      start_time: new_start_time,
      end_time: newEndTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', placement_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check prerequisites
  const { data: prereqs } = await supabase
    .from('lvfr_aemt_prerequisites')
    .select('requires_block_id, rule_type')
    .eq('block_id', placement.content_block_id);

  const violations: Array<{ block_id: string; requires_block_id: string; rule_type: string; message: string }> = [];

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
      } else if (prereq.rule_type === 'must_precede' && reqDay >= new_day_number) {
        violations.push({
          block_id: placement.content_block_id,
          requires_block_id: prereq.requires_block_id,
          rule_type: prereq.rule_type,
          message: prereq.requires_block_id + ' must come before day ' + new_day_number,
        });
      }
    }
  }

  return NextResponse.json({ placement: updated, violations });
}
