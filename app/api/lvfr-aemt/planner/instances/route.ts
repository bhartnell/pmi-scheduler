import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// POST /api/lvfr-aemt/planner/instances — Create new plan instance
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { name, start_date, template_id } = body;

  if (!name || !start_date) {
    return NextResponse.json({ error: 'name and start_date are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: instance, error } = await supabase
    .from('lvfr_aemt_plan_instances')
    .insert({
      name,
      start_date,
      template_id: template_id || null,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If template_id provided, copy placements from the template's latest instance
  if (template_id) {
    const { data: sourceInstance } = await supabase
      .from('lvfr_aemt_plan_instances')
      .select('id')
      .eq('template_id', template_id)
      .neq('id', instance.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sourceInstance) {
      const { data: sourcePlacements } = await supabase
        .from('lvfr_aemt_plan_placements')
        .select('content_block_id, day_number, start_time, end_time, duration_min, sort_order')
        .eq('instance_id', sourceInstance.id);

      if (sourcePlacements && sourcePlacements.length > 0) {
        // Calculate dates for the new instance
        const newPlacements = sourcePlacements.map(p => {
          const weekIndex = Math.floor((p.day_number - 1) / 3);
          const dayInWeek = (p.day_number - 1) % 3;
          const daysToAdd = weekIndex * 7 + dayInWeek;
          const d = new Date(start_date + 'T12:00:00');
          d.setDate(d.getDate() + daysToAdd);
          const date = d.toISOString().split('T')[0];

          return {
            instance_id: instance.id,
            content_block_id: p.content_block_id,
            day_number: p.day_number,
            date,
            start_time: p.start_time,
            end_time: p.end_time,
            duration_min: p.duration_min,
            sort_order: p.sort_order,
          };
        });

        await supabase.from('lvfr_aemt_plan_placements').insert(newPlacements);
      }
    }
  }

  return NextResponse.json({ instance });
}
