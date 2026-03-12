import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// PUT /api/lvfr-aemt/planner/placements — Add or update a placement
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { instance_id, content_block_id, day_number, start_time, end_time, duration_min, instructor_id, sort_order } = body;

  if (!instance_id || !content_block_id || !day_number || !start_time) {
    return NextResponse.json({ error: 'instance_id, content_block_id, day_number, and start_time are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Calculate date from instance start_date + day_number
  const { data: instance } = await supabase
    .from('lvfr_aemt_plan_instances')
    .select('start_date')
    .eq('id', instance_id)
    .single();

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  const weekIndex = Math.floor((day_number - 1) / 3);
  const dayInWeek = (day_number - 1) % 3;
  const daysToAdd = weekIndex * 7 + dayInWeek;
  const d = new Date(instance.start_date + 'T12:00:00');
  d.setDate(d.getDate() + daysToAdd);
  const date = d.toISOString().split('T')[0];

  // Get content block for duration if not provided
  let actualDuration = duration_min;
  let actualEndTime = end_time;
  if (!actualDuration || !actualEndTime) {
    const { data: block } = await supabase
      .from('lvfr_aemt_content_blocks')
      .select('duration_min')
      .eq('id', content_block_id)
      .single();
    if (block) {
      actualDuration = actualDuration || block.duration_min;
      if (!actualEndTime) {
        const [h, m] = start_time.split(':').map(Number);
        const total = h * 60 + m + actualDuration;
        actualEndTime = String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
      }
    }
  }

  // Check if this block is already placed in this instance (on any day)
  const { data: existing } = await supabase
    .from('lvfr_aemt_plan_placements')
    .select('id')
    .eq('instance_id', instance_id)
    .eq('content_block_id', content_block_id)
    .limit(1);

  let placement;
  if (existing && existing.length > 0) {
    // Update existing placement
    const { data, error } = await supabase
      .from('lvfr_aemt_plan_placements')
      .update({
        day_number,
        date,
        start_time,
        end_time: actualEndTime,
        duration_min: actualDuration,
        instructor_id: instructor_id || null,
        sort_order: sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    placement = data;
  } else {
    // Insert new placement
    const { data, error } = await supabase
      .from('lvfr_aemt_plan_placements')
      .insert({
        instance_id,
        content_block_id,
        day_number,
        date,
        start_time,
        end_time: actualEndTime,
        duration_min: actualDuration,
        instructor_id: instructor_id || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    placement = data;
  }

  // Check prerequisites for this placement
  const violations = await checkPrerequisites(supabase, instance_id, content_block_id, day_number);

  return NextResponse.json({ placement, violations });
}

async function checkPrerequisites(supabase: ReturnType<typeof getSupabaseAdmin>, instanceId: string, blockId: string, dayNumber: number) {
  // Get prerequisites for this block
  const { data: prereqs } = await supabase
    .from('lvfr_aemt_prerequisites')
    .select('requires_block_id, rule_type')
    .eq('block_id', blockId);

  if (!prereqs || prereqs.length === 0) return [];

  // Get all placements for this instance
  const { data: allPlacements } = await supabase
    .from('lvfr_aemt_plan_placements')
    .select('content_block_id, day_number')
    .eq('instance_id', instanceId);

  const placedBlocks = new Map<string, number>();
  for (const p of (allPlacements || [])) {
    placedBlocks.set(p.content_block_id, p.day_number);
  }

  const violations: Array<{ block_id: string; requires_block_id: string; rule_type: string; message: string }> = [];

  for (const prereq of prereqs) {
    const reqDay = placedBlocks.get(prereq.requires_block_id);

    if (reqDay === undefined) {
      violations.push({
        block_id: blockId,
        requires_block_id: prereq.requires_block_id,
        rule_type: prereq.rule_type,
        message: prereq.requires_block_id + ' is not yet placed on the schedule',
      });
    } else if (prereq.rule_type === 'must_precede' && reqDay >= dayNumber) {
      violations.push({
        block_id: blockId,
        requires_block_id: prereq.requires_block_id,
        rule_type: prereq.rule_type,
        message: prereq.requires_block_id + ' must be scheduled before day ' + dayNumber + ' (currently on day ' + reqDay + ')',
      });
    } else if (prereq.rule_type === 'consecutive_day' && Math.abs(reqDay - dayNumber) > 1) {
      violations.push({
        block_id: blockId,
        requires_block_id: prereq.requires_block_id,
        rule_type: prereq.rule_type,
        message: prereq.requires_block_id + ' should be on a consecutive day (day ' + reqDay + ' vs day ' + dayNumber + ')',
      });
    }
  }

  return violations;
}
