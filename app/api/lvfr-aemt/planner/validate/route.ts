import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// POST /api/lvfr-aemt/planner/validate — Check all prerequisite rules
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { instance_id } = body;

  if (!instance_id) {
    return NextResponse.json({ error: 'instance_id is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Get all placements for this instance
  const { data: placements } = await supabase
    .from('lvfr_aemt_plan_placements')
    .select('content_block_id, day_number')
    .eq('instance_id', instance_id);

  // Get all prerequisites
  const { data: prerequisites } = await supabase
    .from('lvfr_aemt_prerequisites')
    .select('block_id, requires_block_id, rule_type');

  // Get content block names for readable messages
  const { data: blocks } = await supabase
    .from('lvfr_aemt_content_blocks')
    .select('id, name');

  const blockNames = new Map<string, string>();
  for (const b of (blocks || [])) {
    blockNames.set(b.id, b.name);
  }

  // Build placement lookup: block_id -> day_number
  const placedBlocks = new Map<string, number>();
  for (const p of (placements || [])) {
    placedBlocks.set(p.content_block_id, p.day_number);
  }

  const violations: Array<{
    block_id: string;
    block_name: string;
    requires_block_id: string;
    requires_block_name: string;
    rule_type: string;
    message: string;
  }> = [];

  for (const prereq of (prerequisites || [])) {
    const blockDay = placedBlocks.get(prereq.block_id);
    const reqDay = placedBlocks.get(prereq.requires_block_id);

    // Only check if the block itself is placed
    if (blockDay === undefined) continue;

    const blockName = blockNames.get(prereq.block_id) || prereq.block_id;
    const reqName = blockNames.get(prereq.requires_block_id) || prereq.requires_block_id;

    if (reqDay === undefined) {
      violations.push({
        block_id: prereq.block_id,
        block_name: blockName,
        requires_block_id: prereq.requires_block_id,
        requires_block_name: reqName,
        rule_type: prereq.rule_type,
        message: reqName + ' is not yet scheduled (required before ' + blockName + ')',
      });
    } else if (prereq.rule_type === 'must_precede' && reqDay >= blockDay) {
      violations.push({
        block_id: prereq.block_id,
        block_name: blockName,
        requires_block_id: prereq.requires_block_id,
        requires_block_name: reqName,
        rule_type: prereq.rule_type,
        message: reqName + ' (day ' + reqDay + ') must come before ' + blockName + ' (day ' + blockDay + ')',
      });
    } else if (prereq.rule_type === 'consecutive_day') {
      const gap = Math.abs(blockDay - reqDay);
      if (gap > 2) {
        violations.push({
          block_id: prereq.block_id,
          block_name: blockName,
          requires_block_id: prereq.requires_block_id,
          requires_block_name: reqName,
          rule_type: prereq.rule_type,
          message: reqName + ' (day ' + reqDay + ') and ' + blockName + ' (day ' + blockDay + ') should be on consecutive days',
        });
      }
    }
  }

  return NextResponse.json({
    valid: violations.length === 0,
    violations,
    summary: {
      total_placed: placements?.length || 0,
      total_violations: violations.length,
    },
  });
}
