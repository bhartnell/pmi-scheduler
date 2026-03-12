import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// GET /api/lvfr-aemt/planner/templates — List all templates
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: templates, error } = await supabase
    .from('lvfr_aemt_plan_templates')
    .select('id, name, description, total_weeks, days_per_week, class_days, created_at, placement_snapshot')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return templates with has_snapshot flag (don't send the full snapshot in list view)
  const result = (templates || []).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    total_weeks: t.total_weeks,
    days_per_week: t.days_per_week,
    class_days: t.class_days,
    created_at: t.created_at,
    has_snapshot: !!t.placement_snapshot,
    placement_count: Array.isArray(t.placement_snapshot) ? t.placement_snapshot.length : 0,
  }));

  return NextResponse.json({ templates: result });
}

// POST /api/lvfr-aemt/planner/templates — Save current instance as template
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, source_instance_id } = body;

  if (!name || !source_instance_id) {
    return NextResponse.json({ error: 'name and source_instance_id are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Check name uniqueness
  const { data: existing } = await supabase
    .from('lvfr_aemt_plan_templates')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
  }

  // Fetch placements from source instance
  const { data: placements, error: placementsError } = await supabase
    .from('lvfr_aemt_plan_placements')
    .select('content_block_id, day_number, start_time, end_time, duration_min, sort_order')
    .eq('instance_id', source_instance_id)
    .order('day_number', { ascending: true })
    .order('sort_order', { ascending: true });

  if (placementsError) {
    return NextResponse.json({ error: placementsError.message }, { status: 500 });
  }

  // Get source instance for template metadata
  const { data: sourceInstance } = await supabase
    .from('lvfr_aemt_plan_instances')
    .select('template_id')
    .eq('id', source_instance_id)
    .single();

  // Create the template with snapshot
  const { data: template, error: insertError } = await supabase
    .from('lvfr_aemt_plan_templates')
    .insert({
      name,
      description: description || null,
      total_weeks: 10,
      days_per_week: 3,
      class_days: ['Tuesday', 'Wednesday', 'Thursday'],
      placement_snapshot: placements || [],
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update the source instance to reference this template if it doesn't already
  if (sourceInstance && !sourceInstance.template_id) {
    await supabase
      .from('lvfr_aemt_plan_instances')
      .update({ template_id: template.id })
      .eq('id', source_instance_id);
  }

  return NextResponse.json({
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      total_weeks: template.total_weeks,
      created_at: template.created_at,
      has_snapshot: true,
      placement_count: (placements || []).length,
    },
  });
}
