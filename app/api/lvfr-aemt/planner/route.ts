import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lvfr-aemt/planner — Get current plan instance with all placements
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor') &&
      user.role !== 'agency_liaison' &&
      user.role !== 'agency_observer') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const instanceId = request.nextUrl.searchParams.get('instance_id');

  // Get the plan instance (specific or latest)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let instance: any = null;

  if (instanceId) {
    const { data, error } = await supabase
      .from('lvfr_aemt_plan_instances')
      .select('*')
      .eq('id', instanceId)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Plan instance not found' }, { status: 404 });
    }
    instance = data;
  } else {
    const { data, error } = await supabase
      .from('lvfr_aemt_plan_instances')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'No plan instance found' }, { status: 404 });
    }
    instance = data;
  }

  // Get all placements for this instance with content block details
  const { data: placements } = await supabase
    .from('lvfr_aemt_plan_placements')
    .select(`
      id, instance_id, content_block_id, day_number, date,
      start_time, end_time, duration_min, instructor_id, instructor_name,
      confirmed, confirmed_by, confirmed_at, custom_title, custom_notes, sort_order,
      content_block:lvfr_aemt_content_blocks!lvfr_aemt_plan_placements_content_block_id_fkey(
        id, name, duration_min, block_type, min_instructors, equipment,
        chapter_id, module_id, can_split, notes, color
      )
    `)
    .eq('instance_id', instance.id)
    .order('day_number', { ascending: true })
    .order('sort_order', { ascending: true });

  return NextResponse.json({
    instance,
    placements: placements || [],
  });
}
