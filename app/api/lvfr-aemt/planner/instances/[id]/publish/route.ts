import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// PATCH /api/lvfr-aemt/planner/instances/[id]/publish — Toggle publish status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Get current status
  const { data: instance } = await supabase
    .from('lvfr_aemt_plan_instances')
    .select('status')
    .eq('id', id)
    .single();

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  const newStatus = instance.status === 'published' ? 'draft' : 'published';
  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'published') {
    updates.published_at = new Date().toISOString();
    updates.published_by = user.id;
  }

  const { data, error } = await supabase
    .from('lvfr_aemt_plan_instances')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ instance: data });
}
